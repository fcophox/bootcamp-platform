# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Full stack/architecture/status reference:** see `AGENTS.md` — kept there
> once, pointed to from here, to avoid drift. This file covers only
> Claude-Code-specific workflow notes.

## Commands

- `npm run dev` — start dev server (Next.js, http://localhost:3000). Also auto-spawns the Design.MD watcher (see Design tokens below).
- `npm run build` / `npm start` — production build / serve.
- `npm run lint` — ESLint (`eslint-config-next`). Note: the repo currently has ~430 pre-existing lint problems, so a non-zero exit is not necessarily your change.
- `npm run test` — Vitest (`vitest run`); `npm run test:watch` for watch mode. CI runs this and it gates the build.
- `npm run sync-design` — compile `Design.MD` tokens into `app/globals.css` once; `npm run watch-design` for watch mode.

**Bump `package.json` version before pushing** (patch for fixes, minor for
features, major for breaking changes).

Note on *why*: the image tag is the **git SHA**, not the version — CI builds
`ghcr.io/…:develop-<short-sha>` and the GitOps job pins the dev overlay to it,
so pods roll on every commit whether or not you bump. The version is a build arg
surfaced in the UI footer (`v0.1.17 (dev · 7d3d439)` — the fastest way to see
what is actually live). Bump it to keep that footer and the release history
meaningful, not because deployment depends on it.

UI text, error messages, and many code comments are in **Spanish**. Match that when editing user-facing strings.

## Architecture

Next.js 16 App Router + React 19 + Tailwind v4 + TypeScript. Backend is **Convex** (see `### Data & backend` below — Supabase-*shaped* calls are a compatibility shim over Convex, not real Supabase; no `supabase` package is installed). The `@/*` path alias maps to the repo root.

Two product surfaces under `app/`:
- `app/cms/*` — admin/instructor CMS (manage bootcamps, modules, lessons, exams, students, certificates, feedback).
- `app/dashboard/*` — student learning experience (bootcamp player, lessons, exams, certificate, profile).

### Data & backend (Convex — not Supabase, despite file/folder names)

- The backend is **Convex** (`convex/schema.ts` is the live data model), not
  Supabase. `utils/supabase/{server,client}.ts` are compatibility shims that
  expose a Supabase-shaped `.from(table).select().eq()...` API but translate
  every call to Convex functions — see `AGENTS.md` and
  `architecture-roadmap/adr/0003-supabase-compatibility-shim.md`. Don't be
  misled by the `supabase` naming when reading `app/actions/*.ts`.
- `supabase/migrations/*.sql` documents the **historical**, pre-migration
  Postgres schema only — not applied against anything live. `dev.db` and
  `CMS_SETUP.md` are stale SQLite-era artifacts predating even that — ignore
  all three.
- Convex has no RLS equivalent. Authorization lives in Convex function
  handlers and in per-page/per-action checks (see the Auth & roles section
  below), not database policies — there is no structural guardrail against a
  page forgetting its role check.

### Auth & roles
Three roles: `superadmin`, `docente`, `alumno`. The `UserRole` table is authoritative. `utils/roles.ts` resolves a role with fallbacks (user metadata, then hardcoded VIP emails) and is the canonical source for role logic. Server-side lookups go through `utils/roles-server.ts`, client-side through `utils/roles-client.ts`.

Middleware lives in **`proxy.ts`** (Next.js 16's renamed middleware) and only does coarse auth gating — redirects unauthenticated `/cms` and `/dashboard` requests to `/login`. **Role-based authorization is enforced inside pages/actions**, not in middleware (e.g. CMS pages re-check `UserRole` and redirect `alumno` to `/dashboard`).

See `architecture-roadmap/adr/0004-convex-auth-and-role-model.md` for the
full rationale (Convex Auth, the VIP-email fallback, legacy account bridging).

`proxy.ts` also reconciles the request origin before handing off to
`convexAuthNextjsMiddleware` — **read `proxy.ts`'s header comment and
`proxy.test.ts` before changing it.** Deployed behind Cloudflare Tunnel +
Traefik, the pod receives `X-Forwarded-Proto: http` (that hop really is plain
HTTP) while the browser sends `Origin: https://…`, and `request.url` is the raw
internal socket (`http://0.0.0.0:3000/…`). `@convex-dev/auth`'s `isCorsRequest`
compares Origin's protocol against `request.url`'s, so it misfires: `POST
/api/auth` 403s with "Invalid origin", and `validateCors` silently strips the
auth cookies off every other request — surfacing as a `POST /api/presence` 401
flood and server actions failing with "An unexpected response was received from
the server". The Host header is *not* the problem; Traefik forwards it intact.
The browser's `Origin` is the authoritative source for the external scheme —
`X-Forwarded-Proto` is not.

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

### Mutations
Data changes go through server actions in `app/actions/*.ts` (`'use server'`), one file per domain (`bootcamp`, `module`, `exam`, `student`, `invitation`, `certificate`, `feedback`, `profile`). They use the server-side compatibility shim (`utils/supabase/server.ts`, Convex under the hood — see `### Data & backend` above) and call `revalidatePath` / `redirect`. Some flows are self-healing (e.g. invitation acceptance upserts a missing `UserRole`).

### Design tokens (Design.MD → globals.css)
`Design.MD` is the **source of truth** for the design system. `scripts/sync-design.js` parses its CSS-variable tables and regenerates the token blocks in `app/globals.css` (dark + light). `next.config.ts` auto-starts this watcher during `next dev`, so editing `Design.MD` live-updates styles — edit `Design.MD`, not the generated token blocks in `globals.css` directly. Dark mode is the default; theming via `next-themes`.

### Email
`lib/email.ts` sends via SMTP (Nodemailer) first, falling back to **Resend**. Used for student invitations. Requires `SMTP_*` or `RESEND_API_KEY` env vars.

### Other notable pieces
- Rich text: Tiptap (`components/rich-text-editor.tsx`, `tiptap-editor.tsx`).
- Live presence / online users: `contexts/OnlineUsersContext.tsx` + `components/presence-tracker.tsx` (Convex real-time queries).
- Certificates: generated client-side as PDFs (`jspdf` + `html2canvas`).

## Environment
Required env (`.env.local`): `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` (Convex backend — see `### Data & backend` above), `AZURE_STORAGE_ACCOUNT` / `AZURE_STORAGE_KEY` / `AZURE_STORAGE_CONTAINER` / `AZURE_STORAGE_CONNECTION_STRING` (media uploads), `PAT_ENCRYPTION_KEY` (server-only, never `NEXT_PUBLIC_*` — encrypts GitHub PATs for the course git-import feature), plus email creds (`RESEND_API_KEY` or `SMTP_*`). No `SUPABASE_*` vars are used or needed.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
