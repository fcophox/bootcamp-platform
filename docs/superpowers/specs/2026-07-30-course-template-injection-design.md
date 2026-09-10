# Course template injection for empty repos

Date: 2026-07-30
Status: approved

## Problem

Importing a course from a repository that has no content fails with a dead end.
`GET /repos/{owner}/{repo}/git/trees/{ref}?recursive=1` answers **409
`Git Repository is empty.`** when the repository has no commits, and
`fetchRepoFiles` throws a flat string. The UI shows a red box and the user is
stuck — the repo they were told to connect is exactly the repo that cannot be
read yet.

This happened on `CleveritDemo/ai-engineer-cleverit-course-101`: repo created,
`size: 0`, zero branches, a correctly-scoped PAT, and an error message that
blamed the token.

## Goal

When the repository (or the configured path inside it) contains nothing, offer
to commit the existing course template on the user's behalf, then continue the
import. When that write is not possible, say exactly why and fall back to
committing the template by hand.

## Decisions

1. **Confirm before writing.** Detection surfaces a panel listing the files, the
   target branch and the commit message; nothing is written until the user
   clicks. An import attempt must never silently mutate a repository.
2. **Continue into the preview after a successful push**, so the user lands on a
   working connected bootcamp instead of a dead end.
3. **Offer the template only when there are genuinely zero files** — no commits
   at all, or zero files under the configured path. Files that exist but fail to
   parse keep their parse error and get no template offer. Never write over
   content somebody already put there.
4. **One commit.** The Contents API alone would produce one commit per file
   (six), so the Git Data API does the real write.

   Corrected after live validation: the Git Data endpoints (`/git/blobs` AND
   `/git/trees`, even with inline content) answer **409 "Git Repository is
   empty."** until a repository has a first commit. An empty repo is therefore
   bootstrapped through the Contents API — the only write endpoint available
   there — writing the first requested file, and that commit is then replaced by
   a **parentless** commit holding all the files, force-updating the ref. History
   ends as a single clean commit. The force only ever discards the bootstrap
   commit we created seconds earlier, never a user's history.

## Design

### Detection — `lib/courseImport/github.ts`

Every failure is currently a string, so the UI cannot distinguish "empty" from
"broken". Add a typed error:

```ts
export class CourseImportEmptyError extends Error {
  kind: 'repo' | 'path'
}
```

- tree call returns `409` → `kind: 'repo'`
- tree fetched but zero matching blobs under the path → `kind: 'path'`
  (replaces the current flat "No se encontraron archivos" throw)
- files present but unparseable → unchanged parse error

`planImportFromRepo` returns
`{ empty: { kind, owner, repo, ref, path } }` instead of `{ error }`.

### Template source — `lib/courseImport/template.ts` (new)

`TEMPLATE_FILES` and the `examples/course-template/` reader currently live inside
`app/api/courses/template/route.ts`. Extract them so the ZIP download and the
push share one list; otherwise the two drift. The route becomes a consumer.

### Push — `commitFiles()` in `github.ts`

Blobs → tree → commit → ref, one commit, both cases in one code path:

| | empty repo | existing repo |
|---|---|---|
| bootstrap | `PUT /contents/<first file>` (creates the branch) | — |
| `base_tree` | omitted | head commit's tree |
| `parents` | `[]` (discards the bootstrap) | `[headSha]` |
| ref write | `PATCH /git/refs/heads/<ref>` with `force: true` | `PATCH`, no force |

Files are written under the configured `path`.

### Server action — `createTemplateInRepo()`

In `app/actions/courseImport.ts`, behind the existing
`requireDocenteOrSuperadmin()` guard. Reads the template, commits, returns
`{ ok: true }` or `{ error }`.

### UI — `app/cms/bootcamp/create-from-repo/page.tsx`

On `empty`, render the confirm panel. On success re-run `planImportFromRepo` and
fall through to the normal preview. On failure show the mapped error, the
existing "Descargar plantilla .zip" link, and the exact `git` commands.

### Errors

Reuse `describeGithubError`, plus write-specific guidance: a `403` on a write
means the PAT has *Read* but not *Read and Write access to code* — the one
realistic way this fails with an otherwise valid token.

## Testing

Mocked `fetch`, in `lib/courseImport/github.test.ts` and a new
`template.test.ts`:

- `409` on the tree call → `CourseImportEmptyError` with `kind: 'repo'`
- zero files under the path → `kind: 'path'`
- **files present but unparseable → parse error, NOT an empty error** (the
  clobber guard)
- `commitFiles` issues blob → tree → commit → ref in order, with the right
  `parents`/`base_tree` for both empty and non-empty repos, and creates vs
  updates the ref appropriately
- template file list matches what the ZIP route serves
- error messages never contain a PAT

## Out of scope

Creating the repository itself, choosing a different template, and multi-course
repositories.
