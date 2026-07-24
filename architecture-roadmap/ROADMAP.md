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
