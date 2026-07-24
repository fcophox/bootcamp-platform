# 0001. Next.js App Router with two product surfaces

## Status
Accepted (retroactively documented)

## Context
The platform serves two distinct audiences from one codebase: instructors/admins
(bootcamp, module, lesson, exam, student, certificate, feedback management) and
students (bootcamp player, lessons, exams, certificate, profile). Both need
server-rendered pages, shared auth/session state, and shared UI primitives.

## Decision
Use a single Next.js 16 App Router application with two top-level route trees:
- `app/cms/*` — instructor/admin surface.
- `app/dashboard/*` — student learning surface.

Both surfaces share `proxy.ts` (Next.js 16's renamed middleware) for coarse
authentication gating, and `utils/roles*.ts` for role resolution. Role-based
*authorization* (e.g. redirecting an `alumno` away from `/cms`) is enforced
inside each page/action, not centrally in middleware.

## Consequences
- One deploy, one build, shared design system (`Design.MD` → `app/globals.css`)
  and component library (`components/*`) across both surfaces.
- Role checks are duplicated across CMS pages/actions rather than centralized —
  a deliberate trade-off documented in the codebase (`CLAUDE.md`), not an
  oversight; keeps middleware simple and fast (coarse gating only).
- Any new CMS page must remember to add its own role check; there is no
  structural guardrail preventing a page from skipping it.
