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
database/auth backend was in use: `app/actions/storage.ts` uses
`@azure/storage-blob` to mint a SAS upload URL (server action), and
`lib/azure-upload.ts` performs the actual upload client-side via a direct
`fetch` PUT to that SAS URL. Required env vars: `AZURE_STORAGE_ACCOUNT`,
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
