# Roadmap — known gaps and next steps

Forward-looking companion to the ADRs in `adr/`. These are observations from
reading the current code, not commitments with owners/dates — treat as a
backlog to triage, not a promise.

## 1. Retire the Supabase-compatibility shim
`utils/supabase/{server,client}.ts` (see
[ADR 0003](adr/0003-supabase-compatibility-shim.md)) let the Supabase→Convex
migration ship without touching 11 action files, but it's a permanent
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

## 7. `xlsx` has no fix on the npm registry (confirmed low current exploitability)
`xlsx@0.18.5` (direct dependency) has two known high-severity CVEs (prototype
pollution `GHSA-4r6h-8v6p-xvw6`, ReDoS `GHSA-5pgg-2g8v-p4x9`) with fixes only
published by SheetJS to their own CDN (`cdn.sheetjs.com`), not to the npm
registry — `npm view xlsx versions` tops out at `0.18.5`, confirmed no newer
npm release exists.

Checked actual usage: the only call site is
`app/cms/encuestas/[bootcampId]/resultados/resultados-client.tsx`, which
only *writes* an export (`utils.aoa_to_sheet` / `utils.book_new` /
`writeFile`) built from data already fetched from Convex — it never calls
`XLSX.read`/`readFile`/parses any uploaded or user-supplied file. Both CVEs
live in SheetJS's parsing path, which this codebase never invokes, so the
real-world exploitability today is low (no attacker-reachable input reaches
the vulnerable code). Still worth fixing since usage could change, but not
urgent.

A real fix means switching the dependency source to a CDN tarball URL (e.g.
`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`), which is a
supply-chain trust change (installing from a third-party CDN instead of the
npm registry) worth a deliberate decision, not a routine bump — deferred here.

## 8. eslint 9→10 major bump needed to clear remaining dev-only CVEs
The last ~10 open Dependabot/`npm audit` findings (`ajv`, `brace-expansion`,
`minimatch`, `@eslint/config-array`, `@eslint/eslintrc`, and `eslint` itself)
are all transitive, lint-time-only dependencies of `eslint@9.39.x` — they
never ship to users or run on untrusted input, so the real-world risk is low.
`npm audit` reports the fix requires `eslint@10.8.0`, a major version, and
`eslint-config-next@16.1.4` is pinned to `eslint` peer range `>=9.0.0` with no
confirmed 10.x compatibility yet — bumping needs its own verification pass
(does `eslint-config-next` support eslint 10? does the Next.js flat-config
setup still work?) rather than a blind version bump. Deferred as a separate,
focused piece of work.

## 9. `.update()` on the compatibility shim silently no-ops without `.eq('id', ...)`
Found while writing tests for `utils/supabase/server.ts`
(`utils/supabase/server.test.ts`): `ConvexMutationBuilder.execute()` only
calls `genericUpdate`/`genericDelete` `if (this.targetId || this.targetIds)`.
Calling `.from(table).update(doc)` — or `.delete()` — without a preceding
`.eq('id', x)` (or `.in('id', [...])`) matches nothing, calls no mutation,
and resolves as `{ data: null, error: null }` with no error, no warning, no
thrown exception. Every current call site in `app/actions/*.ts` happens to
always chain `.eq('id', ...)`, so this hasn't caused a known bug — but the
shim itself gives no protection against a future call site that forgets
it, since the Supabase client it mimics would normally require some target
condition too, just not silently. Worth either throwing when no target is
set, or auditing call sites once the shim is being touched anyway (see
item 1).
