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
- `npm run lint` — ESLint. No test runner is configured.
- `npm run sync-design` / `npm run watch-design` — compile `Design.MD` tokens
  into `app/globals.css` once / in watch mode.
