# Architecture Roadmap + AGENTS.md/CLAUDE.md refresh — Design

Date: 2026-07-24
Status: Approved

## Purpose

Document and defend the current architecture of `bootcamp-platform`, including a
significant undocumented fact discovered during exploration: the backend has been
fully migrated from Supabase (Postgres + Auth) to Convex, but `CLAUDE.md` and
`README.md` still describe the stack as Supabase-based, and the migration was done
via a compatibility shim (`utils/supabase/server.ts`, `utils/supabase/client.ts`)
that makes the transition invisible to ~29 call sites in `app/actions/*.ts`.

This is a documentation-only change. No application code is modified.

## Key findings that drive the content

- **No Supabase runtime config exists.** `.env` has no `NEXT_PUBLIC_SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY`. Auth is 100% `@convex-dev/auth` (`proxy.ts`,
  `convex/auth.ts`).
- **`utils/supabase/{server,client}.ts` are compatibility shims**, not real Supabase
  clients. They implement a `.from(table).select().eq()...` builder API on top of
  generic Convex functions (`convex/db.ts`: `genericQuery` / `genericInsert` /
  `genericUpdate` / `genericDelete` / `genericUpsert`), keyed through a
  `TABLE_MAP` that translates PascalCase Supabase-style table names (`Bootcamp`,
  `UserRole`, ...) to Convex table names (`bootcamps`, `legacyAuth`, ...).
- **`convex/schema.ts` is the real source of truth** for the data model today.
  `supabase/migrations/*.sql` describes the schema as it existed on real Postgres
  before commit `6132637` ("migración completa a Convex Auth") — historical, not
  live.
- **Dual ID support**: the shim and several actions accept both legacy numeric IDs
  and Convex string IDs, to support records created before/after the migration.
- Media uploads go through **Azure Blob Storage** (`lib/azure-upload.ts`,
  `app/actions/storage.ts`), not Convex file storage or Supabase Storage.
- Email goes through Nodemailer/SMTP first, falling back to Resend
  (`lib/email.ts`).
- **Dead leftovers**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in
  `.env` with zero references in code — an abandoned auth experiment, not part of
  the live stack. `dev.db` and `CMS_SETUP.md` are stale SQLite-era artifacts
  (already called out in `CLAUDE.md`).
- Two product surfaces (`app/cms/*`, `app/dashboard/*`), three roles
  (`superadmin`, `docente`, `alumno`) resolved via `utils/roles.ts` with
  metadata → hardcoded-email fallback.

## Deliverables

### 1. `architecture-roadmap/` folder

```
architecture-roadmap/
├── README.md                                        # index/how to navigate
├── adr/
│   ├── 0001-nextjs-app-router-two-surfaces.md
│   ├── 0002-supabase-to-convex-migration.md
│   ├── 0003-supabase-compatibility-shim.md
│   ├── 0004-convex-auth-and-role-model.md
│   ├── 0005-dual-legacy-numeric-and-convex-string-ids.md
│   ├── 0006-azure-blob-for-media-storage.md
│   ├── 0007-design-tokens-single-source-of-truth.md
│   └── 0008-server-actions-for-mutations.md
├── c4/
│   ├── 01-context.md       # Mermaid C4Context
│   ├── 02-containers.md    # Mermaid C4Container
│   └── 03-components.md    # Mermaid C4Component (CMS vs Dashboard, actions, shim, roles)
└── ROADMAP.md               # forward-looking gaps (see below)
```

ADR format: lightweight MADR-style — `Status` (all `Accepted (retroactively
documented)` since these are past decisions being reconstructed, not proposed),
`Context`, `Decision`, `Consequences`. Each ADR is grounded in what was found in
code/commits — no speculation presented as fact; where rationale is inferred
rather than confirmed, the ADR says so explicitly.

`ROADMAP.md` covers: finishing removal of the Supabase-shaped shim in favor of
direct Convex calls, removing dead Clerk env vars, deciding the fate of
`supabase/migrations/*.sql` and `dev.db` (archive vs delete), and re-validating
that `CLAUDE.md`'s RLS-heavy guidance is now obsolete (RLS was a Postgres/Supabase
concept; Convex has its own auth-in-function-handler model).

C4 diagrams use Mermaid (`C4Context`/`C4Container`/`C4Component` syntax) embedded
in markdown fences — renders on GitHub and in-editor without extra tooling.

### 2. `AGENTS.md` (new, canonical stack/status doc)

Covers: tech stack (accurate — Next.js 16, React 19, Convex, Azure Blob, Tailwind
v4), both product surfaces, real data model (Convex, with the historical-Supabase
caveat), auth/roles, the `TABLE_MAP` naming convention, conventions (Spanish
UI strings), commands, and a "known issues / in-progress" section mirroring
`ROADMAP.md`'s highlights.

### 3. `CLAUDE.md` update

Fix the "Backend is Supabase" inaccuracy. Trim stack/status content that now
lives in `AGENTS.md`; keep Claude-Code-specific material (commands, Spanish
UI-string convention, pointers to `Design.MD` sync flow) and add a pointer:
"See `AGENTS.md` for full stack/architecture/status — kept here only to avoid
drift." Update the Data & Supabase / Auth sections to reflect Convex-as-truth
and the shim, per the ADRs.

## Out of scope

- No changes to application code, `convex/*`, `app/*`, migrations, or env files.
- No new tooling/build step for diagram generation (plain Mermaid-in-markdown).
- Not attempting to fully reverse-engineer *why* each historical decision was
  made beyond what commits/code support — ADRs note inferred vs. confirmed
  rationale.

## Self-review notes

- No placeholders/TBDs — every ADR maps to a verified code fact.
- Consistency: `ROADMAP.md` and `AGENTS.md`'s "known issues" section both derive
  from the same findings list above, kept in sync by writing them from this spec.
- Scope: single cohesive documentation deliverable, no decomposition needed.
