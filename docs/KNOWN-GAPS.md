# Known gaps and follow-ups

Open items known to the team, with enough context to act on them without
rediscovering the problem. Remove an entry when it is closed — a stale list is
worse than none.

Last reviewed: 2026-07-30.

---

## 0. Production points at a *dev* Convex deployment — blocks releasing to `main`

**Merging `develop` into `main` is not safe until this is resolved.**

**In progress:** `orbital-k3s-gitops` PR #10 adds a self-hosted Convex backend
to the `bootcamp-platform-prod` namespace, mirroring dev, so production stops
depending on a cloud dev-tier deployment. Follow
`apps/bootcamp-platform/convex-selfhosted-prod/RUNBOOK.md`. It is blocked on two
credentials: **Vault write access** to create
`bootcamp-platform/convex-selfhosted-prod`, and **membership of the
`francisco-designer` Convex team** to export `tame-finch-608`.

Measured on 2026-07-30:

| | Backend |
| --- | --- |
| Prod app (`bootcamp.nodrize.dev`, v0.1.12) | `tame-finch-608` — a personal **cloud dev** deployment (team `francisco-designer`) |
| `CONVEX_DEPLOY_KEY_PROD` | `prod:industrious-eagle-67` |
| `industrious-eagle-67` | **0 documents** |
| `tame-finch-608` | 5 bootcamps, all real accounts |

Two problems follow:

1. Building `main` with `NEXT_PUBLIC_CONVEX_URL_PROD` set to
   `industrious-eagle-67` would point production at an empty database: all data
   gone from the UI, every user logged out. The variable is currently set to
   `tame-finch-608` to match reality, so a merge preserves today's behaviour —
   but that is a guard, not a fix.
2. The Convex deploy on `main` targets `industrious-eagle-67`, which nothing
   reads, while `tame-finch-608` never receives new functions. Shipping app
   code that calls a new Convex function would fail in production with
   `Could not find public function` — the same class of bug that broke the
   course import on dev.

**To close**, pick one:

- **Migrate:** get access to `tame-finch-608`, `convex export` it, import into
  `industrious-eagle-67`, then set `NEXT_PUBLIC_CONVEX_URL_PROD` to the cloud
  prod deployment. Prod then matches its deploy key and the sync CronJob's
  source becomes real.
- **Adopt:** treat `tame-finch-608` as the production backend, obtain a deploy
  key for it, and replace `CONVEX_DEPLOY_KEY_PROD`. Cheaper, but leaves
  production on a personal dev deployment owned by another team.

Until then, releases to `main` ship Next.js changes only and must not depend on
any new or changed Convex function.

## 1. Production Convex is empty

`industrious-eagle-67` (cloud, backs `main`) holds **0 documents**. Every real
bootcamp and account lives in `tame-finch-608`, a *personal cloud dev*
deployment owned by the `francisco-designer` team that most of us cannot access.

Consequences:

- The weekly `convex-prod-to-dev-sync` CronJob copies prod → self-hosted dev,
  so it copies nothing. It now fails loudly instead of silently wiping dev
  (guard added in `orbital-k3s-gitops` PR #9).
- Anyone without access to that team cannot export the data. `npx convex dev`
  does not fail in that case — it silently creates a *new personal project* and
  repoints `.env.local` at it.

**To close:** get access to `tame-finch-608` (or have its owner export), then
`convex export` → `convex import --replace-all` into the target backend. Decide
whether prod should be seeded from it or start clean.

## 2. Dev accounts are not the old dev accounts

`develop` now runs against the self-hosted backend, which started empty. Users
must sign up again. Superadmins are covered by the hardcoded overrides in
`lib/vipEmails.ts`; everyone else defaults to `alumno`.

**To close:** either seed the backend (see gap 1) or add the accounts the team
needs for testing.

## 3. The sidebar flashes an admin menu before the role resolves

`components/sidebar.tsx`:

```ts
const fallbackRole = pathname.startsWith('/cms') ? 'superadmin' : 'alumno';
const role = roleFromDB || currentUser?.role || fallbackRole;
```

While `getRoleByEmail` is loading, *anyone* on a `/cms` path renders the admin
sidebar, then it corrects itself. The server still enforces authorization, so
this is cosmetic — but an `alumno` who navigates to `/cms` briefly sees admin
menu items before being redirected.

**To close:** render nothing until the role resolves (there is already a
`roleResolved` guard nearby to extend), rather than guessing from the path.

## 4. The course template is Spanish-only

`examples/course-template/` (README, AGENTS.md, the authoring skill and the
example content) is written in Spanish, matching the project convention. It is
committed into **external** authors' repositories, who may not read Spanish.

**To close:** ship English variants alongside, and have the template's README
link between them.

## 5. Role resolution is spread across four call sites

`lib/vipEmails.ts` is now the single source for the hardcoded overrides, and a
test fails if any file re-declares one. But the *lookup order* still differs
per path:

| Path | Order |
| --- | --- |
| `convex/users.ts` `getCurrentUserWithRole` | VIP → `users.role` → `legacyAuth` |
| `convex/legacyAuth.ts` `getRoleByEmail` | VIP → `legacyAuth` → `users.role` |
| `utils/roles.ts` `getRoleFromEmail` | VIP → metadata |

They agree today because VIP wins first, but a user with conflicting records in
`users` and `legacyAuth` would resolve differently depending on which path
asked.

**To close:** one Convex query that every caller uses.

## 6. `CONVEX_SITE_ORIGIN` on the self-hosted backend is an internal URL

`orbital-k3s-gitops` `convex-selfhosted/backend-statefulset.yaml` sets it to
`http://convex-backend.bootcamp-platform-dev.svc.cluster.local:3211`, and the
ingress deliberately exposes only the API port (3210). `convex/auth.config.ts`
uses `process.env.CONVEX_SITE_URL` as the JWT issuer.

Password sign-in works today (verified end to end). Anything needing the site
origin to be publicly reachable — OAuth callbacks, magic links, externally
fetched JWKS — is untested and likely broken.

**To close:** expose port 3211 and set `CONVEX_SITE_ORIGIN` to a public
hostname before adding any such flow.

## 7. Accidental Convex project

`joyous-mockingbird-491` (team `diego-pinto`, project `bootcamp-platform`) was
created by an `npx convex dev` run that could not access the configured project.
Empty and unused. `convex project` has no delete subcommand — remove it from the
Convex dashboard.

## 8. Leftover scratch repository

`diegopintog/scratch-tpl-verify-2` was used to validate template seeding against
the live GitHub API. Archived; delete when convenient (needs the `delete_repo`
scope).

## 9. Repo-wide lint debt

`npm run lint` reports ~430 pre-existing problems (mostly
`@typescript-eslint/no-explicit-any`), so a non-zero exit does not indicate a
regression and CI does not gate on it. Typecheck and tests **are** clean and
**do** gate.

**To close:** burn down by directory and add lint to the CI gate.

## 10. Dependabot alerts

GitHub reports 3 high-severity vulnerabilities on the default branch. Not
triaged during this work.
