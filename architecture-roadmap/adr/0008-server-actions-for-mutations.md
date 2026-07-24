# 0008. Next.js Server Actions as the sole mutation layer

## Status
Accepted (retroactively documented)

## Context
Every domain (bootcamp, module, exam, student, invitation, certificate,
feedback, profile, masterclass, medicion, storage) needs create/update/delete
operations reachable from both CMS forms and dashboard interactions, with
Next.js cache invalidation and redirects handled consistently.

## Decision
All mutations go through `'use server'` functions in `app/actions/*.ts`, one
file per domain. Each action obtains a client via
`createClient()` (the shim from [[0003-supabase-compatibility-shim]]),
performs the operation, then calls `revalidatePath()` and/or `redirect()` as
needed. Some flows are self-healing by design — e.g. invitation acceptance
upserts a missing `UserRole` row rather than failing if one doesn't exist yet.

## Consequences
- No separate REST/GraphQL API layer exists for mutations — server actions
  are called directly from form actions / client components.
- Because every action goes through the same shim, the entire mutation layer
  inherited the Supabase→Convex migration "for free" (see
  [[0003-supabase-compatibility-shim]]) — no action file needed rewriting to
  change backends.
- Authorization is re-checked per action (per
  [[0004-convex-auth-and-role-model]]), not centralized — consistent with,
  and reinforcing, the same trade-off made for page-level route access.
