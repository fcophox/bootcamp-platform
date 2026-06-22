# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Next.js, http://localhost:3000). Also auto-spawns the Design.MD watcher (see Design tokens below).
- `npm run build` / `npm start` — production build / serve.
- `npm run lint` — ESLint (`eslint-config-next`). No test runner is configured.
- `npm run sync-design` — compile `Design.MD` tokens into `app/globals.css` once; `npm run watch-design` for watch mode.

UI text, error messages, and many code comments are in **Spanish**. Match that when editing user-facing strings.

## Architecture

Next.js 16 App Router + React 19 + Tailwind v4 + TypeScript. Backend is **Supabase** (Postgres + Auth, accessed via `@supabase/ssr`). The `@/*` path alias maps to the repo root.

Two product surfaces under `app/`:
- `app/cms/*` — admin/instructor CMS (manage bootcamps, modules, lessons, exams, students, certificates, feedback).
- `app/dashboard/*` — student learning experience (bootcamp player, lessons, exams, certificate, profile).

### Data & Supabase
- Tables use **PascalCase** names and **camelCase** columns (e.g. `Bootcamp`, `Lesson`, `UserRole`, `BootcampStudent`, `LessonFeedback`) — a Prisma-style schema queried directly via the Supabase client. There is **no Prisma/ORM** in use; `dev.db` and `CMS_SETUP.md` are stale SQLite-era artifacts — ignore them.
- Supabase clients: `utils/supabase/server.ts` (server components/actions, throws if env unset), `utils/supabase/client.ts` (browser), `utils/supabase/middleware.ts` (session refresh).
- Schema changes are hand-written numbered SQL in `supabase/migrations/NN_*.sql`, applied manually against the Supabase project (no automated migration step). Several migrations exist specifically to fix recursive **RLS** policies — RLS is relied on heavily and is easy to break; mirror existing policy patterns when touching tables.

### Auth & roles
Three roles: `superadmin`, `docente`, `alumno`. The `UserRole` table is authoritative. `utils/roles.ts` resolves a role with fallbacks (user metadata, then hardcoded VIP emails) and is the canonical source for role logic. Server-side lookups go through `utils/roles-server.ts`, client-side through `utils/roles-client.ts`.

Middleware lives in **`proxy.ts`** (Next.js 16's renamed middleware) and only does coarse auth gating — redirects unauthenticated `/cms` and `/dashboard` requests to `/login`. **Role-based authorization is enforced inside pages/actions**, not in middleware (e.g. CMS pages re-check `UserRole` and redirect `alumno` to `/dashboard`).

### Mutations
Data changes go through server actions in `app/actions/*.ts` (`'use server'`), one file per domain (`bootcamp`, `module`, `exam`, `student`, `invitation`, `certificate`, `feedback`, `profile`). They use the server Supabase client and call `revalidatePath` / `redirect`. Some flows are self-healing (e.g. invitation acceptance upserts a missing `UserRole`).

### Design tokens (Design.MD → globals.css)
`Design.MD` is the **source of truth** for the design system. `scripts/sync-design.js` parses its CSS-variable tables and regenerates the token blocks in `app/globals.css` (dark + light). `next.config.ts` auto-starts this watcher during `next dev`, so editing `Design.MD` live-updates styles — edit `Design.MD`, not the generated token blocks in `globals.css` directly. Dark mode is the default; theming via `next-themes`.

### Email
`lib/email.ts` sends via SMTP (Nodemailer) first, falling back to **Resend**. Used for student invitations. Requires `SMTP_*` or `RESEND_API_KEY` env vars.

### Other notable pieces
- Rich text: Tiptap (`components/rich-text-editor.tsx`, `tiptap-editor.tsx`).
- Live presence / online users: `contexts/OnlineUsersContext.tsx` + `components/presence-tracker.tsx` (Supabase Realtime).
- Certificates: generated client-side as PDFs (`jspdf` + `html2canvas`).

## Environment
Required env (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (admin-only operations), plus email creds (`RESEND_API_KEY` or `SMTP_*`).
