# Course Git-Import Design

**Goal:** Let a docente author a full course (bootcamp + modules + lessons,
including exams) as files in a git repository, and import/re-sync it into
the platform from the CMS — without hand-authoring the same content twice
between a repo and the manual UI.

**Architecture:** One idempotent upsert engine (a Convex mutation) fed by
files parsed out of a GitHub repo tarball. The manual CMS UI already writes
through the single-record equivalent of this engine; the git importer is a
new front door onto the same underlying model, not a second copy of it.
Fetching, parsing, and diffing happens in Next.js (server action), matching
the existing rule that only Next.js talks to Convex and to the outside
world — Convex only ever receives a clean, already-parsed upsert payload.

**Tech stack:** GitHub REST API (tarball endpoint) for fetching, a markdown
parser (`remark`/`rehype` or equivalent) to convert lesson bodies to the
HTML shape lessons already store, `js-yaml` for frontmatter/config parsing,
Convex mutations for the upsert engine, Node's built-in `crypto` (AES-256-GCM,
key from Vault) plus the `server-only` package (already a transitive
dependency via `@convex-dev/auth` — add it as a direct dependency) for
PAT-at-rest.

## Global Constraints

- Git-import is scoped to **creating new bootcamps only** in this iteration
  — connecting git-sync to an existing, manually-authored bootcamp is out of
  scope. A connected bootcamp's repo owns all of its content permanently.
- No public API route and no webhook receiver in this iteration — sync is
  **pull-based only**, triggered by a docente clicking "Sync now" (or the
  initial import). No CronJob, no public ingress.
- The manual CMS UI is **not touched** by this feature except: (a) it must
  disable/hide manual add-module/add-lesson controls on a git-managed
  bootcamp, and (b) a new "connected to repo" panel + Sync now button on the
  bootcamp manage page.
- Every mutating sync operation (initial import and every re-sync) is
  **plan → apply**: compute and show a diff before writing anything, no
  silent overwrites.
- PATs are never stored in plaintext. Docs must tell the docente to create a
  **fine-grained, read-only, single-repo** GitHub PAT — not a classic PAT
  with org-wide scope.
- Lesson types supported end to end: `text` (markdown), `video`, `pdf`,
  `podcast` (all three as URL-referencing frontmatter, no asset upload in
  this iteration), and `exam` (structured YAML). `presentation`,
  `exam_formal`, `subtitle`, `check` stay manual-UI-only for now — parser
  should error clearly on an unrecognized `type`, never silently drop it.

---

## 1. Repo format

```
course.yaml                        # bootcamp-level metadata
modules/
  01-introduccion/
    module.yaml                    # optional: title override
    01-bienvenida.md               # text lesson
    02-video-intro.md              # video lesson (frontmatter only)
    03-quiz.yaml                   # exam lesson
  02-fundamentos/
    module.yaml
    01-conceptos.md
    02-material.md                 # pdf/podcast lesson (frontmatter only)
```

- **Ordering** is the numeric prefix on the folder/file name (`01-`, `02-`,
  ...). The prefix is stripped from the display title unless the file/
  `module.yaml` sets an explicit `title`.
- A repo can hold **multiple courses** at different subpaths — the "path"
  field in "Add course from repo" points at the folder containing one
  `course.yaml`. (Nothing walks the whole repo looking for multiple
  `course.yaml` files in this iteration; one connection = one bootcamp.)
- Anything in the target path that isn't a recognized file
  (`course.yaml`, `module.yaml`, a lesson file under a module folder) is
  ignored, not an error — keeps room for a README, LICENSE, CI config, etc.
  living alongside the course content in the same repo.

### `course.yaml`

```yaml
title: "Bootcamp de Data Engineering"
description: "Programa intensivo de 8 semanas."
duration: "8 semanas"
level: "Intermedio"          # Principiante | Intermedio | Avanzado
startDate: "2026-09-01"
icon: "database"
color: "blue"
enableChecklist: true
enableRanking: true
```

All fields map 1:1 to what `createBootcamp` (`app/actions/bootcamp.ts:9`)
already takes from the manual form. `title`, `description`, `duration`,
`level`, `startDate` are required; the rest have the same defaults the
manual flow uses today (`icon: 'code'`, `color: 'green'`,
`enableChecklist`/`enableRanking: true`).

### `module.yaml` (optional, per module folder)

```yaml
title: "Introducción"   # overrides the folder-name-derived title
```

If absent, the module title is derived from the folder name (prefix
stripped, dashes → spaces, title-cased).

### Text lesson (`NN-slug.md`)

```markdown
---
title: "Bienvenida al curso"
type: text
---

# Bienvenida

Contenido en **markdown** estándar. Se convierte a HTML en el import.
```

Body is parsed markdown → HTML, stored in the same
`{ html, imageUrl }` JSON shape `lessons.content` already uses for
`type: text` (see `manage-client.tsx:612-628`). `imageUrl` stays empty for
git-imported text lessons in this iteration (no local-image-embedding
pipeline — see "Deferred" below).

### Video / PDF / podcast lesson (`NN-slug.md`, frontmatter only)

```markdown
---
title: "Introducción en video"
type: video          # video | pdf | podcast
url: "https://..."    # already-hosted URL — no upload pipeline in v1
duration: 600          # optional, seconds
---
```

Body is ignored for these types (or can hold optional lesson notes —
parser should just not require one).

### Exam lesson (`NN-slug.yaml`)

```yaml
title: "Quiz módulo 1"
type: exam
settings:
  duration: 15   # minutes
questions:
  - text: "¿Qué es un pipeline de datos?"
    options:
      - text: "Opción A"
        correct: true
      - text: "Opción B"
        correct: false
```

Maps directly to the `{ questions, settings: { duration } }` shape
`lessons.content` already stores for `type: exam`
(`manage-client.tsx:597-611`).

---

## 2. Data model changes (`convex/schema.ts`)

```ts
bootcamps: defineTable({
  // ...existing fields...
  sourceRepo: v.optional(v.string()),        // "owner/repo"
  sourcePath: v.optional(v.string()),        // subpath containing course.yaml
  sourceRef: v.optional(v.string()),         // branch, default "main"
  sourcePatEncrypted: v.optional(v.string()),// AES ciphertext, never plaintext
  lastSyncedAt: v.optional(v.number()),
  lastSyncStatus: v.optional(v.string()),    // "success" | "error"
  lastSyncError: v.optional(v.string()),
})

modules: defineTable({
  // ...existing fields...
  sourcePath: v.optional(v.string()),        // repo-relative path, upsert key
})

lessons: defineTable({
  // ...existing fields...
  sourcePath: v.optional(v.string()),        // repo-relative path, upsert key
  sourceHash: v.optional(v.string()),        // content hash, skip-if-unchanged
})
```

`sourcePath` (not Convex's `_id`) is the stable key re-sync matches against.
`sourceHash` (e.g. SHA-256 of the raw file bytes) lets re-sync skip
unchanged files without needing GitHub blob SHAs from the tarball.

---

## 3. Import / sync execution flow

Both "Add course from repo" and "Sync now" run the same two-step flow:

### Plan

1. Server action fetches `GET /repos/{owner}/{repo}/tarball/{ref}` using the
   (decrypted, in-memory-only) PAT.
2. Extracts and reads only the configured subpath.
3. Parses `course.yaml`, each `module.yaml`, and each lesson file. Any
   parse error (bad YAML, missing required frontmatter field, unrecognized
   `type`) aborts the whole plan with a clear per-file error — no partial
   plan.
4. Diffs parsed tree against current DB state (by `sourcePath`):
   - path not in DB → **create**
   - path in DB, `sourceHash` changed → **update**
   - path in DB, `sourceHash` unchanged → **skip**
   - DB record's `sourcePath` not in parsed tree → **delete**
5. Returns the diff summary to the CMS UI (counts + a list of what's
   deleted, since that's the one destructive case worth naming explicitly).

### Apply

6. Docente confirms in the UI.
7. Server action calls a new Convex mutation,
   `courses.applyImport({ bootcampId?, plan })`, that performs all
   creates/updates/deletes for the bootcamp (and, on first import, the
   bootcamp record itself) as one call. On success, updates
   `lastSyncedAt`/`lastSyncStatus: "success"`. On failure, records
   `lastSyncStatus: "error"` + `lastSyncError` and leaves prior data intact
   (mutation either fully succeeds or fully fails — no partial apply).

Initial import and re-sync are the same code path; initial import is just
"apply against an empty diff" (everything is a create).

---

## 4. PAT handling

- CMS UI copy explicitly instructs: create a **fine-grained personal access
  token**, scoped to **this one repository**, with **Contents: Read-only**
  permission. No write scope needed anywhere in this design.

### Encryption scheme (concrete, no new dependency)

- **AES-256-GCM** via Node's built-in `crypto` module — authenticated
  encryption, not just confidentiality: GCM's auth tag means a
  tampered/corrupted ciphertext fails decryption loudly instead of silently
  producing garbage bytes that get used as a "PAT."
- New server-only module, e.g. `utils/crypto.ts`, exporting `encryptPat`/
  `decryptPat`. Guarded with the `server-only` package (`import
  'server-only'` at the top) so an accidental client-side import is a build
  error, not a runtime leak.
- Per encryption: generate a random 12-byte IV, encrypt, capture the 16-byte
  auth tag. Store as one string in `sourcePatEncrypted`:
  `base64(iv).base64(authTag).base64(ciphertext)`. Decrypt reverses this and
  throws (surfaced as a clear "reconnect this repo" error) if the tag check
  fails.
- **Key**: 32 random bytes (`openssl rand -hex 32`), one new key per Vault
  KV path already backing `bootcamp-platform-{dev,prod}`'s existing
  `ExternalSecret` (`orbital-k3s-gitops/apps/bootcamp-platform/
  external-secrets/{dev,prod}.yaml` — both use `dataFrom: extract`, so this
  is one more field in the existing secret, no new manifest). Exposed as
  `PAT_ENCRYPTION_KEY`, read server-side only — **never** prefixed
  `NEXT_PUBLIC_*`, since those are baked into the client bundle at build
  time.
- Dev and prod get independent keys (same as every other secret here) —
  ciphertext from one environment is never decryptable in the other, which
  is fine since dev/prod already have entirely separate Convex data.

### Access boundaries

- Decryption happens **only** inside the Next.js server action that's about
  to call GitHub, immediately before the fetch. The decrypted value is a
  local variable scoped to that single call — never cached, never returned
  to the client, never passed into any Convex mutation/query argument.
- The "connected to repo" panel in the CMS shows repo/path/branch/last-sync
  status only — never the token, never even a masked suffix.
- Error messages from a failed GitHub fetch (401/403/etc.) must be
  sanitized before logging or surfacing to the UI — never include the
  `Authorization` header or the raw PAT in a thrown error, a `console.error`,
  or the `lastSyncError` field written back to Convex.
- Storing ciphertext rather than plaintext also matters against a second
  audience: the self-hosted Convex dashboard is admin-key-gated but shared
  (no per-user login, see the Convex self-hosting ADR) — anyone with that
  admin key can browse table contents directly, so a plaintext PAT sitting
  in a `bootcamps` row would otherwise be trivially readable there.

### Key rotation (accepted limitation, not built in v1)

- Rotating `PAT_ENCRYPTION_KEY` makes every previously-stored
  `sourcePatEncrypted` value undecryptable — the next sync attempt fails
  with the tag-mismatch error above. V1 does **not** implement key
  versioning or multi-key decryption. Given the expected number of
  connected repos is small, the accepted mitigation is operational: rotating
  the key requires each affected docente to reconnect (re-enter their PAT)
  via the CMS. Worth revisiting if/when the number of connected courses
  grows enough that this becomes a real operational burden.

---

## 5. CMS UI

- **`/cms`**: new "Agregar curso desde repositorio" action alongside the
  existing "Crear bootcamp" button.
- **New flow**: form (repo URL, subpath, branch — default `main`, PAT) →
  Plan preview (counts of modules/lessons to be created, any parse errors)
  → confirm → Apply → redirect to `/cms/bootcamp/{id}/manage`, same as the
  manual creation flow's redirect today (`app/actions/bootcamp.ts:55`).
- **`/cms/bootcamp/[id]/manage`**, when `sourceRepo` is set: a panel showing
  `Conectado a: {owner}/{repo} @ {sourcePath} (rama: {sourceRef})`, last
  sync status/timestamp, and a **Sync now** button (same plan → apply
  flow). Manual "add module" / "add lesson" controls are hidden, replaced
  with a note that this bootcamp is git-managed and edits should go through
  the repo.

---

## 6. Starter template

- One example repo in the GitHub org, marked as a **GitHub template
  repository** (native "Use this template" button) — contains a working
  `course.yaml`, one module with one lesson of each supported type, and a
  README documenting the frontmatter format. This is the canonical example:
  no separate example lives only in docs, to avoid drift.
- CMS also offers a "Descargar plantilla .zip" button, generated from the
  same example content, for anyone not going through GitHub directly.
- No repo-creation-on-behalf-of-the-docente flow — keeps the PAT
  permanently read-only, no write scope ever requested.

---

## Deferred / explicitly out of scope this iteration

- Public API route / external callers other than the git importer itself.
- Webhook-triggered or scheduled auto-sync (manual "Sync now" only).
- Attaching git-sync to an already-existing, manually-created bootcamp.
- `presentation`, `exam_formal`, `subtitle`, `check` lesson types from git.
- Local image assets embedded in markdown (auto-upload to Azure) — v1 text
  lessons can only reference already-hosted image URLs, same as video/pdf/
  podcast.
- Sync run history/log table (`syncRuns`) beyond the single
  `lastSyncedAt`/`lastSyncStatus`/`lastSyncError` fields on `bootcamps` —
  worth adding later if debugging failed imports from just the last-run
  fields proves insufficient in practice.

## Risks / open items to watch during implementation

- GitHub API rate limits: a read-only fine-grained PAT still shares the
  standard 5,000 req/hr authenticated limit — one tarball download per sync
  keeps this a non-issue, but worth confirming the extraction step doesn't
  accidentally make per-file API calls.
- Deleting a lesson with student `lessonCompletions`/`examSubmissions`
  attached orphans that history rather than cascading (schema doesn't
  enforce foreign keys here already) — acceptable per this design, but
  worth a deliberate call-out in the plan preview UI so it's not a surprise.
- Markdown → Tiptap-HTML fidelity: the manual editor's rich text feature
  set (embedded images, specific formatting) may not have a clean 1:1
  markdown equivalent — needs verification during implementation that the
  conversion covers what course content realistically needs, not just
  headings/paragraphs/lists/code blocks.
