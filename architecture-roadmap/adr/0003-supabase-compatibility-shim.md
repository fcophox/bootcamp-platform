# 0003. Supabase-shaped compatibility shim over Convex

## Status
Accepted (retroactively documented)

## Context
`app/actions/*.ts` (bootcamp, student, profile, exam, invitation, feedback,
masterclass, module, storage, medicion, certificate — 11 files at time of
writing) all call `createClient()` from `@/utils/supabase/server` and use the
Supabase-style `.from(table).select().eq(...).order(...)` query builder.
Rewriting all of them to call Convex functions directly at the same time as
migrating auth ([[0002-supabase-to-convex-migration]]) would have been a much
larger, riskier change.

## Decision
`utils/supabase/server.ts` and `utils/supabase/client.ts` are **not** Supabase
clients. They are hand-written shims (`ConvexQueryBuilder`, `ConvexMutationBuilder`,
`ConvexTableBuilder`) that expose the same chainable `.from().select().eq()...`
surface but translate every call into one of four generic Convex functions in
`convex/db.ts`:
- `genericQuery` (select + eq/in filters + order, executed in-memory per query)
- `genericInsert`, `genericUpdate`, `genericDelete`, `genericUpsert`

Table name translation goes through a `TABLE_MAP` in `convex/db.ts` that maps
PascalCase Supabase-style names (`Bootcamp`, `UserRole`, `LessonFeedback`, ...)
to the real Convex table names (`bootcamps`, `legacyAuth`, `lessonFeedbacks`,
...). `createClient()`'s returned `auth` object also fakes the subset of the
Supabase Auth API actually used (`getUser`, `getSession`) by resolving the
current user through `convexAuthNextjsToken()` + `api.users.getCurrentUserWithRole`.

## Consequences
- Every one of the 11 `app/actions/*.ts` files works unmodified against Convex —
  the migration was possible without touching call-site logic.
- Filtering happens **in-memory after `collect()`** inside `genericQuery`
  (see `convex/db.ts`), not via Convex indexes — acceptable at current data
  volume but a scalability ceiling worth watching (tracked in `ROADMAP.md`).
- The shim is a leaky abstraction: it only implements the subset of the
  Supabase client actually used by this codebase (no `rpc()`, no real-time
  `channel()` on the server client, `client.ts`'s `channel()` is a no-op stub).
  Anyone adding a new Supabase-API call that isn't already shimmed will get a
  silent no-op or a runtime error, not a compile error.
- New code should prefer calling Convex functions directly rather than
  extending the shim further — see `ROADMAP.md`.
