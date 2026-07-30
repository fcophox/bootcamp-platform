# AGENTS.md

Canonical stack/architecture/status reference for any coding agent working in
this repo (Claude Code, Codex, or otherwise). For Claude-Code-specific
conventions (commands, workflow), see `CLAUDE.md`. For the full rationale
behind each decision below, see `architecture-roadmap/adr/`.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript.
- **Styling:** Tailwind v4, tokens generated from `Design.MD` — see
  `architecture-roadmap/adr/0007-design-tokens-single-source-of-truth.md`.
- **Backend/database/auth:** Convex (`@convex-dev/auth`) — **not Supabase**.
  `convex/schema.ts` is the live data model. See
  `architecture-roadmap/adr/0002-supabase-to-convex-migration.md`.
- **Media storage:** Azure Blob Storage (`lib/azure-upload.ts`,
  `app/actions/storage.ts`).
- **Email:** Nodemailer/SMTP first, Resend fallback (`lib/email.ts`).
- **Rich text:** Tiptap.
- **Certificates:** client-side PDF generation (`jspdf` + `html2canvas`).
- **Live presence:** Convex-backed (`contexts/OnlineUsersContext.tsx`,
  `components/presence-tracker.tsx`).

## Important: Supabase naming is legacy, the backend is not Supabase

`utils/supabase/server.ts` and `utils/supabase/client.ts` are named after
Supabase for historical reasons but are compatibility shims that translate a
Supabase-shaped `.from(table).select().eq()...` API into Convex calls. Do not
assume a file importing `createClient` from `@/utils/supabase/*` talks to
Supabase — it talks to Convex. See
`architecture-roadmap/adr/0003-supabase-compatibility-shim.md`.

`supabase/migrations/*.sql` is historical documentation of the pre-migration
Postgres schema, not something applied against any live database. `dev.db`
and `CMS_SETUP.md` are stale SQLite-era artifacts — ignore both.

## Product surfaces

- `app/cms/*` — admin/instructor CMS (bootcamps, modules, lessons, exams,
  students, certificates, feedback, encuestas/medición).
- `app/dashboard/*` — student learning experience (bootcamp player, lessons,
  exams, certificate, profile).

Both are gated only for *authentication* by `proxy.ts`; *role*-based
authorization is re-checked inside each page/action via `utils/roles*.ts`.

`proxy.ts` additionally reconciles the request origin before delegating to
`convexAuthNextjsMiddleware`. Behind Cloudflare Tunnel + Traefik the pod sees
`X-Forwarded-Proto: http` while the browser sends `Origin: https://…`, and
`request.url` is the raw internal socket (`http://0.0.0.0:3000/…`).
`@convex-dev/auth`'s `isCorsRequest` compares those protocols, so it misfires:
`POST /api/auth` 403s "Invalid origin" and `validateCors` strips the auth
cookies off every other request (`POST /api/presence` 401 flood; server actions
failing with "An unexpected response was received from the server"). The Host
header is fine — Traefik forwards it intact. Read `proxy.ts`'s header comment
and `proxy.test.ts` before touching this.

## Data model

Tables live in Convex (`convex/schema.ts`), addressed by camelCase names
(`bootcamps`, `modules`, `lessons`, `bootcampStudents`, `lessonFeedbacks`,
`legacyAuth`, ...). The Supabase-era PascalCase names (`Bootcamp`,
`UserRole`, `LessonFeedback`, ...) survive only as shim call-site vocabulary,
translated via the `TABLE_MAP` in `convex/db.ts`.

Two ID shapes coexist: legacy numeric (pre-migration) and Convex string IDs
(post-migration) — see
`architecture-roadmap/adr/0005-dual-legacy-numeric-and-convex-string-ids.md`.

## Auth & roles

Three roles: `superadmin`, `docente`, `alumno`. `utils/roles.ts:
getRoleFromEmail()` resolves role from user metadata, then a hardcoded VIP
email allowlist, then defaults to `alumno`. See
`architecture-roadmap/adr/0004-convex-auth-and-role-model.md`.

## Mutations

All go through `'use server'` functions in `app/actions/*.ts`, one file per
domain, calling the compatibility shim then `revalidatePath`/`redirect`. See
`architecture-roadmap/adr/0008-server-actions-for-mutations.md`.

## Conventions

- UI text, error messages, and many code comments are in **Spanish** —
  match that when editing user-facing strings. (Engineering docs like this
  one are in English.)
- Edit `Design.MD`, never the generated token blocks in `app/globals.css`
  directly (`scripts/sync-design.js` regenerates them; `next.config.ts`
  auto-watches in dev).
- **Bump `package.json` version before pushing** (patch for fixes, minor for
  features, major for breaking changes).

  Note on *why*: the image tag is the **git SHA**, not the version. CI builds
  `ghcr.io/cleveritdemo/bootcamp-platform:develop-<short-sha>` (plus the moving
  `:develop`), and the `promote-dev` job pins the dev overlay in
  `orbital-k3s-gitops` to that SHA tag — so pods roll on **every** commit,
  bumped or not. `NEXT_PUBLIC_APP_VERSION` is a build arg surfaced in the UI
  footer (`v0.1.17 (dev · 7d3d439)`), which is the fastest way to confirm what
  is actually live. Bump it to keep that footer and the release history
  meaningful, not because deployment depends on it.

### Convex functions are deployed separately from the app

`convex/` (functions + schema) does **not** travel in the Docker image — the
image only carries `NEXT_PUBLIC_CONVEX_URL` pointing at the backend. CI deploys
them in the `Deploy Convex functions` job; the `image` job depends on it, so app
code can't ship ahead of the backend it calls.

**The two environments use different Convex backends:**

| Branch | Backend | Auth | Secret |
|---|---|---|---|
| `develop` | **self-hosted, in-cluster** — `convex-dev.nodrize.dev` | admin key | `CONVEX_SELF_HOSTED_ADMIN_KEY` |
| `main` | **cloud** production deployment | deploy key | `CONVEX_DEPLOY_KEY_PROD` |

The self-hosted backend is defined in `orbital-k3s-gitops` under
`apps/bootcamp-platform/convex-selfhosted/` (StatefulSet + Service on ports
3210/3211, ingress, and a weekly CronJob that exports cloud-prod and
`--replace-all` imports it into dev — **dev data is overwritten every Monday**).

Self-hosted mode is selected by `CONVEX_SELF_HOSTED_URL` / `_ADMIN_KEY`, and the
cloud variables must be *absent* or the CLI prefers them — hence the `env -u
CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT` in both CI and the sync CronJob.

The admin key lives in Vault and is synced to the `convex-selfhosted` secret:

```bash
kubectl -n bootcamp-platform-dev get secret convex-selfhosted \
  -o jsonpath='{.data.ADMIN_KEY}' | base64 -d
```

**If the branch's secret is not set, the job logs a warning and skips**, and
Convex changes silently never reach the backend.

To push functions by hand to the self-hosted dev backend:

```bash
env -u CONVEX_DEPLOY_KEY -u CONVEX_DEPLOYMENT \
  CONVEX_SELF_HOSTED_URL=https://convex-dev.nodrize.dev \
  CONVEX_SELF_HOSTED_ADMIN_KEY="$(kubectl -n bootcamp-platform-dev get secret \
    convex-selfhosted -o jsonpath='{.data.ADMIN_KEY}' | base64 -d)" \
  npx convex deploy --yes
```

To check what is actually live on a deployment:

```bash
curl -s -X POST "$NEXT_PUBLIC_CONVEX_URL/api/query" -H 'Content-Type: application/json' \
  -d '{"path":"courseImport:applyImport","args":{},"format":"json"}'
# "Could not find public function" = not deployed
# ArgumentValidationError                = deployed, just needs args
```

## Branch strategy

Modeled on `soporte-ti-knowledgebase-wikijs`'s conventions:

```
main ─────────────────────────────────────────────► production
  └── develop ────────────────────────────────────► dev env (auto-deployed)
        └── feature/* or fix/* ──► PR to develop
```

| Branch | Purpose | Protected | Auto-deploy |
|---|---|---|---|
| `main` | Production | Yes — PR + passing CI required, no direct push | Yes — every push builds `:prod-<sha>` and CI auto-commits it to the gitops repo |
| `develop` | Integration / dev staging | No (not yet enabled) | Yes — every push builds `:develop-<sha>` and CI auto-commits it to the gitops repo |
| `feature/*`, `fix/*` | New work | No | No |

Day to day: branch off `develop`, PR into `develop`, verify on
`bootcamp-dev.nodrize.dev`, then PR `develop` → `main` when ready to ship.
After merging to `main`, CI auto-promotes to prod.

## Deployment

Docker image built via `Dockerfile` (Next.js standalone output), pushed to
`ghcr.io/cleveritdemo/bootcamp-platform` — `:develop`/`:develop-<sha>` on push
to `develop`, `:prod`/`:prod-<sha>` on push to `main`
(`.github/workflows/ci.yml`). Deployed to the shared `orbital-k3s-1` k3s
cluster (Flux GitOps, separate repo `orbital-k3s-gitops`), namespaces
`bootcamp-platform-dev`/`-prod`, secrets via Vault + External Secrets
Operator on a dedicated KV mount, `/api/healthz` backing real readiness/
liveness probes, per-namespace ResourceQuota/LimitRange, a prod
PodDisruptionBudget, and Traefik rate limiting on both ingresses. See
`architecture-roadmap/adr/0009-kubernetes-deployment-shared-cluster.md` and
`architecture-roadmap/kubernetes-deployment-runbook.md`.

## Known issues / in progress

See `architecture-roadmap/ROADMAP.md` for full detail. Highlights:
- The Supabase-compatibility shim is a permanent-feeling indirection layer,
  not just a migration aid — no active plan to remove it yet.
- `supabase/migrations/*.sql`, `dev.db` sit in the repo as historical/dead
  weight with no archive/delete decision made.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in `.env` are
  unused dead config from an abandoned auth experiment.

## Commands

- `npm run dev` — start dev server (also auto-spawns the Design.MD watcher).
- `npm run build` / `npm start` — production build / serve.
- `npm run lint` — ESLint. ~430 pre-existing problems, so a non-zero exit is
  not necessarily your change.
- `npm run test` — Vitest (`vitest run`); `npm run test:watch` for watch mode.
  CI runs this and it gates the build.
- `npm run sync-design` / `npm run watch-design` — compile `Design.MD` tokens
  into `app/globals.css` once / in watch mode.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
