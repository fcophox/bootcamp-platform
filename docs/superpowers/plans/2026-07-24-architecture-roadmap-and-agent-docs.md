# Architecture Roadmap + AGENTS.md/CLAUDE.md Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `architecture-roadmap/` (ADRs + C4 diagrams + roadmap) documenting the real, current architecture of `bootcamp-platform` — including the undocumented Supabase→Convex migration — and refresh `AGENTS.md` (new, canonical) / `CLAUDE.md` (trimmed, pointer) so they no longer describe a Supabase backend that no longer exists.

**Architecture:** Pure documentation change. No application code, `convex/*`, `app/*`, migrations, or env files are touched. Each deliverable is a standalone markdown file; tasks are ordered so ADRs land before the C4 diagrams and roadmap/agent docs that reference them.

**Tech Stack:** Markdown, Mermaid (`C4Context`/`C4Container`/`C4Component` diagrams-as-code, no extra tooling needed — renders natively on GitHub and in most editors).

## Global Constraints

- No application code changes — this plan only creates/edits markdown files.
- UI-facing strings elsewhere in the repo are Spanish per `CLAUDE.md`, but these are internal engineering docs (ADRs/C4/AGENTS.md/CLAUDE.md) — write them in **English**, matching the existing `CLAUDE.md`/`README.md` convention.
- Every ADR: `Status: Accepted (retroactively documented)` — these describe past decisions being reconstructed from code/commits, not new proposals.
- Every architectural claim must be traceable to a file/commit found during research (spec: `docs/superpowers/specs/2026-07-24-architecture-roadmap-and-agent-docs-design.md`). Do not invent rationale; where rationale is inferred rather than confirmed in a commit message, say so explicitly (e.g. "Inferred rationale:").
- Base directory for the new folder: repo root → `architecture-roadmap/`.

---

### Task 1: ADR 0001–0002 (App Router surfaces, Supabase→Convex migration)

**Files:**
- Create: `architecture-roadmap/adr/0001-nextjs-app-router-two-surfaces.md`
- Create: `architecture-roadmap/adr/0002-supabase-to-convex-migration.md`

**Interfaces:**
- Produces: the ADR numbering/filename convention (`NNNN-kebab-title.md`) and section headers (`## Status`, `## Context`, `## Decision`, `## Consequences`) that every subsequent ADR task must match exactly.

- [ ] **Step 1: Write `0001-nextjs-app-router-two-surfaces.md`**

```markdown
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
```

- [ ] **Step 2: Write `0002-supabase-to-convex-migration.md`**

```markdown
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
```

- [ ] **Step 3: Verify both files exist and render correctly**

Run: `ls architecture-roadmap/adr/ && wc -l architecture-roadmap/adr/0001-*.md architecture-roadmap/adr/0002-*.md`
Expected: both files listed, non-zero line counts.

- [ ] **Step 4: Commit**

```bash
git add architecture-roadmap/adr/0001-nextjs-app-router-two-surfaces.md architecture-roadmap/adr/0002-supabase-to-convex-migration.md
git commit -m "docs: add ADR 0001-0002 (app router surfaces, Supabase to Convex migration)"
```

---

### Task 2: ADR 0003–0004 (compatibility shim, Convex auth/role model)

**Files:**
- Create: `architecture-roadmap/adr/0003-supabase-compatibility-shim.md`
- Create: `architecture-roadmap/adr/0004-convex-auth-and-role-model.md`

**Interfaces:**
- Consumes: ADR numbering/section convention from Task 1.
- Produces: none consumed by later tasks beyond being linkable as `[[0003-...]]` / `[[0004-...]]`.

- [ ] **Step 1: Write `0003-supabase-compatibility-shim.md`**

```markdown
# 0003. Supabase-shaped compatibility shim over Convex

## Status
Accepted (retroactively documented)

## Context
`app/actions/*.ts` (bootcamp, student, profile, exam, invitation, feedback,
masterclass, module, storage, medicion, certificate — 29 files at time of
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
- Every one of the 29 `app/actions/*.ts` files works unmodified against Convex —
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
```

- [ ] **Step 2: Write `0004-convex-auth-and-role-model.md`**

```markdown
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
```

- [ ] **Step 3: Verify**

Run: `ls architecture-roadmap/adr/ && wc -l architecture-roadmap/adr/0003-*.md architecture-roadmap/adr/0004-*.md`
Expected: both files listed, non-zero line counts.

- [ ] **Step 4: Commit**

```bash
git add architecture-roadmap/adr/0003-supabase-compatibility-shim.md architecture-roadmap/adr/0004-convex-auth-and-role-model.md
git commit -m "docs: add ADR 0003-0004 (compatibility shim, Convex auth/role model)"
```

---

### Task 3: ADR 0005–0006 (dual IDs, Azure Blob storage)

**Files:**
- Create: `architecture-roadmap/adr/0005-dual-legacy-numeric-and-convex-string-ids.md`
- Create: `architecture-roadmap/adr/0006-azure-blob-for-media-storage.md`

**Interfaces:**
- Consumes: ADR numbering/section convention from Task 1.

- [ ] **Step 1: Write `0005-dual-legacy-numeric-and-convex-string-ids.md`**

```markdown
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
```

- [ ] **Step 2: Write `0006-azure-blob-for-media-storage.md`**

```markdown
# 0006. Azure Blob Storage for media uploads

## Status
Accepted (retroactively documented)

## Context
The platform needs to store user-uploaded media (lesson resources, bootcamp
cover images, masterclass materials, certificates-related assets). Both
Supabase Storage (pre-migration) and Convex file storage (post-migration)
were available alternatives at their respective points in time.

## Decision
Media uploads go through Azure Blob Storage regardless of which
database/auth backend was in use: `lib/azure-upload.ts` wraps
`@azure/storage-blob`, and `app/actions/storage.ts` exposes the server action
used by upload flows. Required env vars: `AZURE_STORAGE_ACCOUNT`,
`AZURE_STORAGE_KEY`, `AZURE_STORAGE_CONTAINER`,
`AZURE_STORAGE_CONNECTION_STRING`, `NEXT_PUBLIC_AZURE_BLOB_BASE`.

Inferred rationale (not confirmed in commit messages): decoupling file storage
from the database backend meant the Supabase→Convex migration
([[0002-supabase-to-convex-migration]]) did not need to also migrate or
re-upload existing media assets — blob URLs kept working unchanged across the
backend switch.

## Consequences
- Media storage survived the backend migration untouched — one fewer moving
  part during a risky cutover.
- The app now depends on three external services (Convex, Azure Blob, and
  email — see below) instead of one (Supabase used to bundle DB+auth+storage).
- No lifecycle/cleanup policy for orphaned blobs (e.g. a lesson resource
  deleted in Convex but not deleted from Azure) is visible in
  `app/actions/storage.ts` — worth confirming is intentional.
```

- [ ] **Step 3: Verify**

Run: `ls architecture-roadmap/adr/ && wc -l architecture-roadmap/adr/0005-*.md architecture-roadmap/adr/0006-*.md`
Expected: both files listed, non-zero line counts.

- [ ] **Step 4: Commit**

```bash
git add architecture-roadmap/adr/0005-dual-legacy-numeric-and-convex-string-ids.md architecture-roadmap/adr/0006-azure-blob-for-media-storage.md
git commit -m "docs: add ADR 0005-0006 (dual ID support, Azure Blob storage)"
```

---

### Task 4: ADR 0007–0008 (design tokens, server actions)

**Files:**
- Create: `architecture-roadmap/adr/0007-design-tokens-single-source-of-truth.md`
- Create: `architecture-roadmap/adr/0008-server-actions-for-mutations.md`

**Interfaces:**
- Consumes: ADR numbering/section convention from Task 1.

- [ ] **Step 1: Write `0007-design-tokens-single-source-of-truth.md`**

```markdown
# 0007. Design.MD as the single source of truth for design tokens

## Status
Accepted (retroactively documented)

## Context
The UI (dark-by-default glassmorphism aesthetic, `Sansation` typography, an
indigo/amber accent system per `Design.MD`) needs consistent CSS variables
across the app, editable by non-engineers without needing to hand-edit
generated CSS.

## Decision
`Design.MD` documents design tokens as markdown tables (CSS variable | dark
value | light value | description). `scripts/sync-design.js` parses those
tables with a regex and regenerates the corresponding `:root`/`.dark` token
blocks in `app/globals.css`. `next.config.ts` auto-spawns
`sync-design.js --watch` whenever `NODE_ENV === "development"`, so editing
`Design.MD` live-updates styles during `npm run dev`. `npm run sync-design`
runs it once (e.g. for CI/build); `npm run watch-design` runs the watcher
standalone.

## Consequences
- `Design.MD` must be edited, not `app/globals.css`'s generated token blocks —
  direct edits there are overwritten by the next sync.
- The regex-based parser in `scripts/sync-design.js` is coupled to the exact
  markdown table format in `Design.MD`; reformatting the tables (e.g. changing
  column order) silently breaks token generation.
- Non-token styling (component-level Tailwind classes, glassmorphism utility
  patterns) is documented in `Design.MD` prose but not enforced by tooling —
  consistency there relies on developers following the doc, not a linter.
```

- [ ] **Step 2: Write `0008-server-actions-for-mutations.md`**

```markdown
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
```

- [ ] **Step 3: Verify**

Run: `ls architecture-roadmap/adr/ && wc -l architecture-roadmap/adr/0007-*.md architecture-roadmap/adr/0008-*.md`
Expected: both files listed, non-zero line counts.

- [ ] **Step 4: Commit**

```bash
git add architecture-roadmap/adr/0007-design-tokens-single-source-of-truth.md architecture-roadmap/adr/0008-server-actions-for-mutations.md
git commit -m "docs: add ADR 0007-0008 (design tokens, server actions)"
```

---

### Task 5: C4 diagrams (context, container, component)

**Files:**
- Create: `architecture-roadmap/c4/01-context.md`
- Create: `architecture-roadmap/c4/02-containers.md`
- Create: `architecture-roadmap/c4/03-components.md`

**Interfaces:**
- Consumes: architecture facts from ADRs 0001–0008 (Task 1–4) — diagrams must not
  contradict them (e.g. must show Convex as the database, not Supabase).

- [ ] **Step 1: Write `01-context.md`**

```markdown
# C4 — Level 1: System Context

Shows Bootcamp Platform's position relative to its users and the external
services it depends on. See ADRs [[0002-supabase-to-convex-migration]] and
[[0006-azure-blob-for-media-storage]] for why these specific externals exist.

\`\`\`mermaid
C4Context
    title System Context — Bootcamp Platform

    Person(alumno, "Alumno", "Student taking bootcamps")
    Person(docente, "Docente", "Instructor managing content")
    Person(superadmin, "Superadmin", "Platform administrator")

    System(platform, "Bootcamp Platform", "Next.js 16 app: CMS (admin/instructor) + Dashboard (student)")

    System_Ext(convex, "Convex", "Database, backend functions, and auth (Convex Auth)")
    System_Ext(azureBlob, "Azure Blob Storage", "Media: lesson resources, cover images, masterclass materials")
    System_Ext(email, "Email (SMTP / Resend)", "Student invitations, password reset")

    Rel(alumno, platform, "Learns, takes exams, gives feedback", "HTTPS")
    Rel(docente, platform, "Manages bootcamps/lessons/exams, views students", "HTTPS")
    Rel(superadmin, platform, "Manages roles, all platform admin", "HTTPS")

    Rel(platform, convex, "Reads/writes data, authenticates users", "Convex client / HTTPS")
    Rel(platform, azureBlob, "Uploads/serves media", "HTTPS")
    Rel(platform, email, "Sends invitation & reset emails", "SMTP / REST")
\`\`\`

**Note:** Supabase does not appear here — it was fully replaced by Convex
(see [[0002-supabase-to-convex-migration]]). `supabase/migrations/*.sql` is
historical only.
```

- [ ] **Step 2: Write `02-containers.md`**

```markdown
# C4 — Level 2: Containers

\`\`\`mermaid
C4Container
    title Container Diagram — Bootcamp Platform

    Person(user, "Alumno / Docente / Superadmin")

    System_Boundary(platform, "Bootcamp Platform") {
        Container(nextapp, "Next.js App", "Next.js 16, React 19, TypeScript", "Renders app/cms/* and app/dashboard/*, runs Server Actions, coarse auth gating via proxy.ts")
        Container(shim, "Supabase-compatibility shim", "TypeScript", "utils/supabase/{server,client}.ts — Supabase-shaped API translated to Convex calls; see ADR 0003")
    }

    System_Boundary(convexSys, "Convex") {
        ContainerDb(convexDb, "Convex Database", "Convex tables", "bootcamps, modules, lessons, exams, bootcampStudents, invitations, certificates, medicion*, users, legacyAuth, etc. (convex/schema.ts)")
        Container(convexFns, "Convex Functions", "convex/*.ts", "genericQuery/genericInsert/genericUpdate/genericDelete/genericUpsert (db.ts), domain functions (bootcamps.ts, exams.ts, ...), auth.ts")
    }

    Container_Ext(azureBlob, "Azure Blob Storage", "Azure", "Media storage")
    Container_Ext(email, "SMTP / Resend", "Nodemailer + Resend", "Transactional email")

    Rel(user, nextapp, "Uses", "HTTPS")
    Rel(nextapp, shim, "Calls .from(table).select/insert/update/delete()")
    Rel(shim, convexFns, "fetchQuery/fetchMutation (server) or ConvexHttpClient (browser)")
    Rel(convexFns, convexDb, "Reads/writes")
    Rel(nextapp, azureBlob, "Uploads/serves media", "lib/azure-upload.ts")
    Rel(nextapp, email, "Sends email", "lib/email.ts")
\`\`\`

Server Actions (`app/actions/*.ts`) run inside the Next.js App container and
are the only path to the shim (see [[0008-server-actions-for-mutations]]).
```

- [ ] **Step 3: Write `03-components.md`**

```markdown
# C4 — Level 3: Components (inside the Next.js App container)

\`\`\`mermaid
C4Component
    title Component Diagram — Next.js App container

    Container_Boundary(nextapp, "Next.js App") {
        Component(proxy, "proxy.ts", "Next.js Middleware", "convexAuthNextjsMiddleware — coarse auth gate for /cms and /dashboard, redirects /login")
        Component(cms, "app/cms/*", "React Server/Client Components", "Admin/instructor surface: bootcamp, module, exam, student, certificate, feedback, encuestas management")
        Component(dashboard, "app/dashboard/*", "React Server/Client Components", "Student surface: bootcamp player, lessons, exams, certificate, profile")
        Component(actions, "app/actions/*.ts", "Server Actions ('use server')", "One file per domain; calls shim, revalidatePath/redirect (ADR 0008)")
        Component(roles, "utils/roles*.ts", "Role resolver", "getRoleFromEmail(): metadata -> hardcoded VIP emails -> default alumno (ADR 0004)")
        Component(shimComp, "utils/supabase/{server,client}.ts", "Compatibility shim", "Supabase-shaped query builder over Convex generic functions (ADR 0003)")
    }

    Rel(proxy, cms, "Gates access to")
    Rel(proxy, dashboard, "Gates access to")
    Rel(cms, actions, "Invokes")
    Rel(dashboard, actions, "Invokes")
    Rel(actions, shimComp, "createClient().from(...)")
    Rel(actions, roles, "Authorization check per action")
    Rel(cms, roles, "Redirects alumno away from /cms")
\`\`\`

Both `app/cms/*` and `app/dashboard/*` independently re-check role via
`utils/roles*.ts` (see [[0001-nextjs-app-router-two-surfaces]] and
[[0004-convex-auth-and-role-model]]) — there is no single authorization
chokepoint in this diagram, by design.
```

- [ ] **Step 4: Verify diagrams are syntactically plausible Mermaid**

Run: `grep -c 'C4Context\|C4Container\|C4Component' architecture-roadmap/c4/*.md`
Expected: each file reports `1` (one diagram type declaration each).

- [ ] **Step 5: Commit**

```bash
git add architecture-roadmap/c4/
git commit -m "docs: add C4 context/container/component diagrams"
```

---

### Task 6: `architecture-roadmap/README.md` and `ROADMAP.md`

**Files:**
- Create: `architecture-roadmap/README.md`
- Create: `architecture-roadmap/ROADMAP.md`

**Interfaces:**
- Consumes: full ADR list (Tasks 1–4) and C4 diagram list (Task 5) for the index.

- [ ] **Step 1: Write `architecture-roadmap/README.md`**

```markdown
# Architecture Roadmap

This folder documents the *actual* current architecture of `bootcamp-platform`
— reconstructed from code and git history, not from the (partially stale)
top-level `CLAUDE.md`/`README.md`. Start here, then drill into ADRs or C4
diagrams as needed. For a live, agent-facing summary of the stack, see
`../AGENTS.md`.

## How to navigate

- **New to this repo?** Read `c4/01-context.md` → `c4/02-containers.md` →
  `c4/03-components.md` in order, top-down.
- **Wondering "why does X work this way"?** Check `adr/` — each decision is
  numbered and cross-linked (`[[NNNN-slug]]` references point to sibling ADRs).
- **Wondering "what's left to clean up"?** See `ROADMAP.md`.

## Architecture Decision Records

| ADR | Title |
|---|---|
| [0001](adr/0001-nextjs-app-router-two-surfaces.md) | Next.js App Router with two product surfaces |
| [0002](adr/0002-supabase-to-convex-migration.md) | Migrate backend from Supabase to Convex |
| [0003](adr/0003-supabase-compatibility-shim.md) | Supabase-shaped compatibility shim over Convex |
| [0004](adr/0004-convex-auth-and-role-model.md) | Convex Auth with three-role, multi-fallback authorization |
| [0005](adr/0005-dual-legacy-numeric-and-convex-string-ids.md) | Support both legacy numeric IDs and Convex string IDs |
| [0006](adr/0006-azure-blob-for-media-storage.md) | Azure Blob Storage for media uploads |
| [0007](adr/0007-design-tokens-single-source-of-truth.md) | Design.MD as the single source of truth for design tokens |
| [0008](adr/0008-server-actions-for-mutations.md) | Next.js Server Actions as the sole mutation layer |

## C4 Diagrams

| Level | File |
|---|---|
| 1 — System Context | [c4/01-context.md](c4/01-context.md) |
| 2 — Containers | [c4/02-containers.md](c4/02-containers.md) |
| 3 — Components | [c4/03-components.md](c4/03-components.md) |

## Roadmap

See [ROADMAP.md](ROADMAP.md) for known gaps and next steps.
```

- [ ] **Step 2: Write `architecture-roadmap/ROADMAP.md`**

```markdown
# Roadmap — known gaps and next steps

Forward-looking companion to the ADRs in `adr/`. These are observations from
reading the current code, not commitments with owners/dates — treat as a
backlog to triage, not a promise.

## 1. Retire the Supabase-compatibility shim
`utils/supabase/{server,client}.ts` (see
[ADR 0003](adr/0003-supabase-compatibility-shim.md)) let the Supabase→Convex
migration ship without touching 29 action files, but it's a permanent
indirection layer now: in-memory filtering after `collect()` in
`genericQuery` (`convex/db.ts`) won't scale as table sizes grow, and it only
implements the subset of the Supabase API already in use. Migrating
`app/actions/*.ts` to call Convex functions directly, file by file, would
remove this ceiling — can be done incrementally, one domain at a time.

## 2. Decide the fate of `supabase/migrations/*.sql` and `dev.db`
Both are historical artifacts from before the Convex migration
([ADR 0002](adr/0002-supabase-to-convex-migration.md)). `CLAUDE.md` already
flags `dev.db`/`CMS_SETUP.md` as stale SQLite-era files to ignore. Options:
archive them under a clearly-labeled `legacy/` path, or delete them now that
`convex/schema.ts` is confirmed to be the live schema — either way, their
current location next to live code invites future confusion.

## 3. Remove dead Clerk environment variables
`.env` defines `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`,
but no code references Clerk anywhere in the repo — an abandoned auth
experiment predating or parallel to the Convex Auth decision
([ADR 0004](adr/0004-convex-auth-and-role-model.md)). Safe to remove once
confirmed unused in any deployment environment (not just local `.env`).

## 4. Re-validate RLS-era guidance is fully gone
Pre-Convex, `CLAUDE.md` leaned heavily on Supabase Row Level Security
policies ("RLS is relied on heavily and is easy to break"). That guidance no
longer applies — Convex has no RLS equivalent; authorization now lives in
function handlers and page/action checks
([ADR 0004](adr/0004-convex-auth-and-role-model.md)). This documentation
effort corrects `CLAUDE.md`'s text, but the *concept* (bypassable
per-page/action authorization, no central enforcement) is worth periodically
auditing since there's no structural guardrail against a forgotten check.

## 5. Collapse legacy numeric IDs into a single ID scheme
[ADR 0005](adr/0005-dual-legacy-numeric-and-convex-string-ids.md) documents
dual-ID support as an intentionally transitional measure. Once confirmed no
production data still carries legacy numeric IDs, the compatibility branches
in `genericQuery` and in `app/actions/student.ts` (and similar call sites)
can be simplified to Convex-ID-only.

## 6. Confirm blob lifecycle policy
[ADR 0006](adr/0006-azure-blob-for-media-storage.md) notes no visible
cleanup path for orphaned Azure Blob assets when the referencing Convex
record is deleted. Confirm whether this is intentional (e.g. handled by a
retention policy on the Azure side) or a gap.
```

- [ ] **Step 3: Verify all links resolve**

Run: `grep -oE '\]\([^)]+\)' architecture-roadmap/README.md architecture-roadmap/ROADMAP.md | grep -oE '\([^)]+\)' | tr -d '()' | sort -u | while read f; do [ -f "architecture-roadmap/$f" ] && echo "OK $f" || echo "MISSING $f"; done`
Expected: every line prints `OK ...`, no `MISSING` lines. (Run from repo root; `README.md` links are relative to `architecture-roadmap/`.)

- [ ] **Step 4: Commit**

```bash
git add architecture-roadmap/README.md architecture-roadmap/ROADMAP.md
git commit -m "docs: add architecture-roadmap index and forward-looking roadmap"
```

---

### Task 7: `AGENTS.md` (new, canonical stack/status doc)

**Files:**
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: findings from ADRs 0001–0008 and `ROADMAP.md` (Tasks 1–6).
- Produces: the document `CLAUDE.md` (Task 8) will point to instead of duplicating stack info.

- [ ] **Step 1: Write `AGENTS.md`**

```markdown
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
```

- [ ] **Step 2: Verify**

Run: `test -f AGENTS.md && grep -c "Supabase" AGENTS.md`
Expected: file exists; grep prints a nonzero count (confirming the Supabase-vs-Convex clarification is present).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md as canonical stack/architecture/status reference"
```

---

### Task 8: `CLAUDE.md` update — fix inaccuracies, trim, point to AGENTS.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `AGENTS.md` (Task 7) as the document being pointed to.

- [ ] **Step 1: Read current `CLAUDE.md` to get exact current text**

Run: `cat CLAUDE.md`

(Use the output to perform the edits below against the real current content —
the excerpts below are the anchors expected to exist; if wording drifted,
match by section instead of exact string.)

- [ ] **Step 2: Add a pointer to AGENTS.md right after the title, before "## Commands"**

Insert this block immediately after the `# CLAUDE.md` title line and its
existing intro paragraph ("This file provides guidance..."), before the
`## Commands` section:

```markdown
> **Full stack/architecture/status reference:** see `AGENTS.md` — kept there
> once, pointed to from here, to avoid drift. This file covers only
> Claude-Code-specific workflow notes.
```

- [ ] **Step 3: Fix the "Data & Supabase" section**

Replace the existing `### Data & Supabase` section (which describes the
backend as Supabase/Postgres with heavy RLS reliance) with:

```markdown
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
```

- [ ] **Step 4: Update the "Auth & roles" section's middleware filename/description if stale**

Confirm the existing `### Auth & roles` section already correctly says
middleware lives in `proxy.ts` and role checks happen in pages/actions (it
does, per the version read in Step 1) — leave as-is, just append one line at
the end of that section:

```markdown

See `architecture-roadmap/adr/0004-convex-auth-and-role-model.md` for the
full rationale (Convex Auth, the VIP-email fallback, legacy account bridging).
```

- [ ] **Step 5: Verify the file no longer claims Supabase is the backend**

Run: `grep -n "Backend is \*\*Supabase\*\*\|Backend is Supabase" CLAUDE.md; echo "exit: $?"`
Expected: no match (grep exits `1`), confirming the old inaccurate claim is gone.

Run: `grep -c "AGENTS.md" CLAUDE.md`
Expected: nonzero — confirms the pointer was added.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: fix CLAUDE.md backend description (Convex, not Supabase), point to AGENTS.md"
```

---

## Self-Review

**Spec coverage:**
- `architecture-roadmap/` folder with `README.md`, `adr/0001`–`0008`,
  `c4/01`–`03`, `ROADMAP.md` → Tasks 1–6. ✓
- `AGENTS.md` canonical doc → Task 7. ✓
- `CLAUDE.md` fix + pointer → Task 8. ✓
- Roadmap section covering shim removal, dead Clerk vars, fate of
  `supabase/migrations`/`dev.db`, RLS-guidance obsolescence → `ROADMAP.md` in
  Task 6, items 1–4. ✓ (item 5–6 are bonus findings from research, not
  required by spec but directly supported by ADR 0005/0006.)

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate X" in any task —
every file has complete, final markdown content ready to write verbatim.

**Type/reference consistency:** ADR filenames referenced via `[[NNNN-slug]]`
in Tasks 1–4 match the exact filenames created in those same tasks; C4
diagrams (Task 5) reference the same ADR slugs; `README.md`/`ROADMAP.md`
(Task 6) link to the exact same ADR and C4 filenames; `AGENTS.md` (Task 7)
and `CLAUDE.md` (Task 8) reference `architecture-roadmap/adr/...` paths
matching Tasks 1–4 exactly.
