# 0004. Convex Auth with three-role, multi-fallback authorization

## Status
Accepted (retroactively documented)

## Context
Three roles exist: `superadmin`, `docente` (instructor), `alumno` (student).
Role must be resolvable both server-side (page/action guards) and client-side
(conditional UI), and must survive users created before the Convex migration
("legacy" accounts).

## Decision
- Auth itself: `convex/auth.ts` — Convex Auth (`@convex-dev/auth`) with a
  `Password` provider; `profile()` stores `email`, `name`, `role` on the
  Convex `users` record at sign-up.
- Route gating: `proxy.ts` uses `convexAuthNextjsMiddleware` +
  `createRouteMatcher` to redirect unauthenticated `/cms` and `/dashboard`
  requests to `/login`, and authenticated users away from `/login`. This is
  coarse — it does not check *role*, only *is authenticated* (consistent with
  [[0001-nextjs-app-router-two-surfaces]]'s "authorization lives in
  pages/actions" decision).
- Role resolution: `utils/roles.ts: getRoleFromEmail()` is the canonical
  resolver, checked in this order: (1) user metadata `role` field, (2) a
  hardcoded email allowlist for VIP/seed accounts (e.g.
  `fcojhormazabalh@gmail.com` → `superadmin`), (3) default `alumno`.
  Server-side lookups additionally go through `utils/roles-server.ts`,
  client-side through `utils/roles-client.ts`.
- A separate `convex/legacyAuth.ts` table/module exists to bridge accounts
  that predate Convex Auth (mapped through the shim's `UserRole` →
  `legacyAuth` table entry in `TABLE_MAP`, see
  [[0003-supabase-compatibility-shim]]).

## Consequences
- Role is trusted from user metadata first — if that field is ever wrong or
  stale, the hardcoded-email fallback can mask it for VIP accounts specifically,
  but not for arbitrary users.
- Because middleware doesn't check role, every CMS route/action is
  individually responsible for calling the role resolver and redirecting
  `alumno` users away — verified per-page, not structurally guaranteed.
- Two auth-adjacent concepts coexist during the transition: Convex Auth
  (current) and `legacyAuth` (bridge for pre-migration accounts) — expected to
  collapse into one once all legacy accounts are migrated (see `ROADMAP.md`).
