# 0002. Migrate backend from Supabase to Convex

## Status
Accepted (retroactively documented)

## Context
The project originally ran on Supabase (Postgres + Supabase Auth), evidenced by
`supabase/migrations/00_create_modules.sql` through `23_create_medicion_tables.sql`
and RLS-focused migrations (`10_fix_recursive_rls_and_token_type.sql`,
`11_ultra_robust_rls.sql`, `16_robust_progress_policies.sql`). Commit `6132637`
("feat: migración completa a Convex Auth y fixes de IDs", 2026-07-22) migrated
auth to `@convex-dev/auth`, and the data model moved to Convex
(`convex/schema.ts` mirrors every former Supabase table: `bootcamps`, `modules`,
`lessons`, `exams`, `bootcampStudents`, `invitations`, `certificates`,
`masterclasses`, the `medicion*` survey tables, etc.).

As of this writing, `.env` has **no Supabase credentials** at all
(`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are absent) —
Supabase is not reachable at runtime even if code referenced it.

## Decision
Fully migrate persistence and auth to Convex:
- `convex/auth.ts` — Convex Auth with a `Password` provider.
- `proxy.ts` — route protection via `convexAuthNextjsMiddleware`.
- `convex/schema.ts` — canonical data model, replacing the Postgres schema.
- `supabase/migrations/*.sql` is retained as **historical record only** of the
  pre-migration schema; it is not applied against anything live.

Inferred rationale (not confirmed in commit messages): avoid a costly rewrite
of ~29 files under `app/actions/*.ts` that call a Supabase-shaped client — see
[[0003-supabase-compatibility-shim]] for how that was achieved.

## Consequences
- `CLAUDE.md`'s "Backend is Supabase" / RLS-heavy guidance (pre-this-change)
  was inaccurate the moment this migration landed — corrected as part of this
  documentation effort (see `AGENTS.md`).
- Convex has no RLS equivalent; authorization now lives in Convex function
  handlers (e.g. `convex/users.ts: getCurrentUserWithRole`) and in
  server-action/page-level checks, not database policies.
- `dev.db` (SQLite) and `CMS_SETUP.md` predate even the Supabase era and were
  already flagged as stale in `CLAUDE.md` — now doubly obsolete.
- Two ID shapes coexist (legacy numeric Postgres IDs vs. Convex string IDs) —
  see [[0005-dual-legacy-numeric-and-convex-string-ids]].
