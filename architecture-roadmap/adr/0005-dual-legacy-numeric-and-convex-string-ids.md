# 0005. Support both legacy numeric IDs and Convex string IDs

## Status
Accepted (retroactively documented)

## Context
Records created before the Convex migration ([[0002-supabase-to-convex-migration]])
carry numeric Postgres-style primary keys; records created after carry Convex's
native string `_id`s. Commit `6132637`'s message explicitly calls out "Fix de
IDs: soporte para Convex string IDs y legacy numeric IDs" and "Ranking público
funciona con ambos tipos de IDs". `app/actions/student.ts: getStudents()`
comments that `bootcampId` "could be numeric (legacy) or Convex string ID".

## Decision
Rather than backfilling/migrating every historical numeric ID to a Convex ID,
the system accepts both shapes at the boundaries that need it:
- `genericQuery`'s in-memory filter (`convex/db.ts`) matches on `_id.toString()`,
  `r.id`, and `r.supabaseUserId` for an `id`-field filter, so either ID shape
  resolves to the same record.
- Public-facing features that predate the migration (ranking pages, certain
  invitation/lesson lookups) explicitly branch or normalize on ID shape rather
  than assuming one format.

## Consequences
- No risky one-time backfill migration was required to cut over.
- Every new query/mutation that filters by `id` must be aware two shapes might
  arrive, or must rely on the shim's `genericQuery` already handling it — this
  is easy to forget in code that talks to Convex directly instead of through
  the shim.
- This is intended as a transitional state, not a permanent design; fully
  retiring legacy numeric IDs is tracked in `ROADMAP.md`.
