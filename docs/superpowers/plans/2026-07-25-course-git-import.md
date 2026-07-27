# Course Git-Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a docente import a full course (bootcamp + modules + lessons,
including exams) from a GitHub repository into the platform, with a
plan → apply flow and encrypted PAT storage.

**Architecture:** One idempotent Convex mutation (`courseImport.applyImport`)
is the single write path. Everything upstream of it — fetching from GitHub,
parsing YAML/markdown, diffing against existing data — runs in Next.js
server actions, matching the codebase's existing rule that only Next.js
talks to Convex and to the outside world.

**Tech stack:** GitHub REST API (Git Trees + Blobs endpoints, native `fetch`,
no new dependency for fetching), `gray-matter` + `js-yaml` for
frontmatter/YAML parsing, `remark` + `remark-html` for markdown→HTML, Node's
built-in `crypto` (AES-256-GCM) for PAT encryption, `server-only` for the
encryption module's import boundary, `jszip` for the starter-template
download.

**Full design reference:** `docs/superpowers/specs/2026-07-25-course-git-import-design.md`

## Global Constraints

- Git-import creates **new bootcamps only** — no attaching to an existing
  manually-built bootcamp (see spec's Global Constraints).
- Sync is **pull-based only** — a "Sync now" button, never a webhook or
  scheduled job.
- Every mutating operation is **plan → apply**: compute and show a diff
  before writing anything.
- PATs are **never stored in plaintext**. Encrypted with AES-256-GCM using a
  key from `process.env.PAT_ENCRYPTION_KEY` (server-only, never
  `NEXT_PUBLIC_*`). Never logged, never returned to any client-reachable
  response.
- Lesson types supported end to end: `text`, `video`, `pdf`, `podcast`
  (URL-referencing), `exam` (structured YAML). Any other `type` in
  frontmatter is a parse error, never silently dropped.
- Content JSON shapes must match what the manual CMS UI already writes
  (verified against `app/cms/bootcamp/[id]/manage/manage-client.tsx:510-549`):
  `text` → `{ html, imageUrl }`; `video`/`pdf`/`podcast` → `{ url, html }`;
  `exam` → `{ questions, settings: { duration } }`.
- Convex mutation deletes must remove **lessons before modules** in
  `applyImport` — `modules.remove` already cascades to its lessons
  (`convex/modules.ts:39-53`), so deleting a lesson that's already been
  cascade-deleted by an earlier module delete would throw. Doing lessons
  first makes any later module-cascade a safe no-op.
- Every task's code must pass `npx tsc --noEmit`, `npx eslint <files>`, and
  `npx vitest run` before being committed (matches this project's established
  practice this session).

## File Structure

- `utils/crypto.ts` — PAT encryption/decryption (server-only).
- `convex/schema.ts` — modified: new optional fields on `bootcamps`,
  `modules`, `lessons`.
- `lib/courseImport/types.ts` — shared types for the whole feature.
- `lib/courseImport/parse.ts` — turns raw repo files into a `ParsedCourse`.
- `lib/courseImport/github.ts` — fetches repo files via GitHub's API.
- `lib/courseImport/diff.ts` — computes an `ImportPlan` from parsed data +
  existing DB state.
- `convex/courseImport.ts` — `getSyncState`, `getBootcampSyncMeta`,
  `applyImport`, `recordSyncFailure`.
- `app/actions/courseImport.ts` — server actions wiring the above together,
  with role-gating.
- `app/cms/bootcamp/create-from-repo/page.tsx` — "Add course from repo" UI.
- `app/cms/bootcamp/[id]/manage/manage-client.tsx` — modified: connected-repo
  panel + Sync now button, manual controls hidden for git-managed bootcamps.
- `app/cms/page.tsx` (or its client component) — modified: new entry point
  button.
- `examples/course-template/` — canonical example course content.
- `app/api/courses/template/route.ts` — zips and serves the example above.

---

### Task 1: PAT encryption utility

**Files:**
- Create: `utils/crypto.ts`
- Create: `utils/crypto.test.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json` (add `server-only` as a direct dependency)

**Interfaces:**
- Produces: `encryptPat(plaintext: string): string`,
  `decryptPat(encoded: string): string` — used by Task 7's server actions.

- [ ] **Step 1: Add `server-only` as a direct dependency**

```bash
npm install server-only
```

(It's already present transitively via `@convex-dev/auth`, so this pins the
version already in `package-lock.json` — no version bump expected.)

- [ ] **Step 2: Alias `server-only` in vitest so tests can import it**

`server-only`'s default export unconditionally throws — it only resolves to
a no-op when a bundler applies Next.js's `react-server` export condition,
which vitest doesn't. Alias it to the package's own no-op build for tests:

Edit `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.ts'],
        exclude: ['node_modules', '.next'],
        server: { deps: { inline: ['convex-test'] } },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            // server-only's default export throws unless a bundler applies
            // Next's "react-server" condition; vitest doesn't, so alias it
            // to the package's own no-op build for tests.
            'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
        },
    },
});
```

- [ ] **Step 3: Write `utils/crypto.ts`**

```ts
import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

function getKey(): Buffer {
    const hex = process.env.PAT_ENCRYPTION_KEY;
    if (!hex) {
        throw new Error('PAT_ENCRYPTION_KEY no está configurada');
    }
    const key = Buffer.from(hex, 'hex');
    if (key.length !== KEY_LENGTH_BYTES) {
        throw new Error(
            `PAT_ENCRYPTION_KEY debe representar ${KEY_LENGTH_BYTES} bytes (${KEY_LENGTH_BYTES * 2} caracteres hex)`
        );
    }
    return key;
}

export function encryptPat(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptPat(encoded: string): string {
    const key = getKey();
    const parts = encoded.split('.');
    if (parts.length !== 3) {
        throw new Error('Formato de PAT cifrado inválido');
    }
    const [ivB64, tagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
}
```

- [ ] **Step 4: Write `utils/crypto.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptPat, decryptPat } from './crypto';

const ORIGINAL_KEY = process.env.PAT_ENCRYPTION_KEY;
const TEST_KEY = 'a'.repeat(64); // 32 bytes as hex

beforeEach(() => {
    process.env.PAT_ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.PAT_ENCRYPTION_KEY;
    else process.env.PAT_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe('encryptPat / decryptPat', () => {
    it('round-trips a plaintext PAT', () => {
        const encrypted = encryptPat('ghp_exampletoken1234');
        expect(encrypted).not.toContain('ghp_exampletoken1234');
        expect(decryptPat(encrypted)).toBe('ghp_exampletoken1234');
    });

    it('produces a different ciphertext each time (random IV)', () => {
        const a = encryptPat('same-value');
        const b = encryptPat('same-value');
        expect(a).not.toBe(b);
        expect(decryptPat(a)).toBe('same-value');
        expect(decryptPat(b)).toBe('same-value');
    });

    it('throws when the ciphertext has been tampered with', () => {
        const encrypted = encryptPat('ghp_exampletoken1234');
        const [iv, tag, ciphertextB64] = encrypted.split('.');
        const tampered = Buffer.from(ciphertextB64, 'base64');
        tampered[0] = tampered[0] ^ 0xff;
        const tamperedEncoded = `${iv}.${tag}.${tampered.toString('base64')}`;
        expect(() => decryptPat(tamperedEncoded)).toThrow();
    });

    it('throws a clear error when PAT_ENCRYPTION_KEY is missing', () => {
        delete process.env.PAT_ENCRYPTION_KEY;
        expect(() => encryptPat('x')).toThrow('PAT_ENCRYPTION_KEY');
    });

    it('throws a clear error when PAT_ENCRYPTION_KEY is the wrong length', () => {
        process.env.PAT_ENCRYPTION_KEY = 'tooshort';
        expect(() => encryptPat('x')).toThrow('32 bytes');
    });

    it('throws on a malformed encoded string', () => {
        expect(() => decryptPat('not-the-right-shape')).toThrow('inválido');
    });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run utils/crypto.test.ts
```

Expected: 6/6 passing.

- [ ] **Step 6: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint utils/crypto.ts utils/crypto.test.ts
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add utils/crypto.ts utils/crypto.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add AES-256-GCM PAT encryption utility"
```

---

### Task 2: Schema migration

**Files:**
- Modify: `convex/schema.ts`

**Interfaces:**
- Produces: `bootcamps.sourceRepo/sourcePath/sourceRef/sourcePatEncrypted/
  lastSyncedAt/lastSyncStatus/lastSyncError`, `modules.sourcePath`,
  `lessons.sourcePath/sourceHash` — all consumed by Task 6's Convex functions.

All new fields are `v.optional`, so this is a non-breaking, additive-only
migration — no data backfill needed.

- [ ] **Step 1: Add the new fields**

In `convex/schema.ts`, change the `bootcamps` table definition from:

```ts
  bootcamps: defineTable({
    title: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    enableChecklist: v.optional(v.boolean()),
    enableRanking: v.optional(v.boolean()),
    isFrozen: v.optional(v.boolean()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    duration: v.optional(v.string()),
    level: v.optional(v.string()),
    startDate: v.optional(v.string()),
    students: v.optional(v.number()),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_slug", ["slug"]),
```

to:

```ts
  bootcamps: defineTable({
    title: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    enableChecklist: v.optional(v.boolean()),
    enableRanking: v.optional(v.boolean()),
    isFrozen: v.optional(v.boolean()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    duration: v.optional(v.string()),
    level: v.optional(v.string()),
    startDate: v.optional(v.string()),
    students: v.optional(v.number()),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
    // Git-import connection (see docs/superpowers/specs/2026-07-25-course-git-import-design.md).
    // sourcePatEncrypted is ciphertext only -- see utils/crypto.ts.
    sourceRepo: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
    sourceRef: v.optional(v.string()),
    sourcePatEncrypted: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.string()),
    lastSyncError: v.optional(v.string()),
  }).index("by_slug", ["slug"]),
```

Change the `modules` table definition from:

```ts
  modules: defineTable({
    title: v.string(),
    order: v.number(),
    bootcampId: v.id("bootcamps"),
    legacyId: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_bootcamp", ["bootcampId"]),
```

to:

```ts
  modules: defineTable({
    title: v.string(),
    order: v.number(),
    bootcampId: v.id("bootcamps"),
    legacyId: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
    // Repo-relative path -- the upsert key git-import re-syncs match against.
    sourcePath: v.optional(v.string()),
  }).index("by_bootcamp", ["bootcampId"]),
```

Change the `lessons` table definition from:

```ts
  lessons: defineTable({
    title: v.string(),
    type: v.string(),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    duration: v.optional(v.any()),
    order: v.number(),
    moduleId: v.optional(v.id("modules")),
    bootcampId: v.optional(v.any()),
    legacyId: v.optional(v.any()),
    legacyModuleId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_module", ["moduleId"]),
```

to:

```ts
  lessons: defineTable({
    title: v.string(),
    type: v.string(),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    duration: v.optional(v.any()),
    order: v.number(),
    moduleId: v.optional(v.id("modules")),
    bootcampId: v.optional(v.any()),
    legacyId: v.optional(v.any()),
    legacyModuleId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
    // Repo-relative path/content-hash pair git-import re-syncs match and
    // skip-if-unchanged against.
    sourcePath: v.optional(v.string()),
    sourceHash: v.optional(v.string()),
  }).index("by_module", ["moduleId"]),
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors (purely additive optional fields).

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all existing tests still pass (schema change is additive).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add git-import fields to bootcamps/modules/lessons schema"
```

---

### Task 3: Course parsing library

**Files:**
- Create: `lib/courseImport/types.ts`
- Create: `lib/courseImport/parse.ts`
- Create: `lib/courseImport/parse.test.ts`

**Interfaces:**
- Consumes: nothing (pure, operates on in-memory `RepoFile[]`).
- Produces: `parseCourseTree(files: RepoFile[], basePath: string): ParsedCourse`
  — consumed by Task 7's server actions. Types `RepoFile`, `ParsedCourse`,
  `ParsedModule`, `ParsedLesson`, `LessonType` — consumed by Tasks 4-9.

- [ ] **Step 1: Install parsing dependencies**

```bash
npm install gray-matter js-yaml remark remark-html
npm install -D @types/js-yaml
```

- [ ] **Step 2: Write `lib/courseImport/types.ts`**

```ts
export type LessonType = 'text' | 'video' | 'pdf' | 'podcast' | 'exam';

export const LESSON_TYPES: LessonType[] = ['text', 'video', 'pdf', 'podcast', 'exam'];

export interface RepoFile {
    path: string; // relative to repo root
    content: string; // utf8 text content
}

export interface ParsedLesson {
    sourcePath: string; // relative to repo root
    title: string;
    type: LessonType;
    order: number;
    content: string; // JSON string, matches lessons.content's existing shape per type
    sourceHash: string;
}

export interface ParsedModule {
    sourcePath: string; // relative to repo root
    title: string;
    order: number;
    lessons: ParsedLesson[];
}

export interface ParsedCourse {
    title: string;
    description: string;
    duration: string;
    level: string;
    startDate: string;
    icon: string;
    color: string;
    enableChecklist: boolean;
    enableRanking: boolean;
    modules: ParsedModule[];
}

export interface ExistingModule {
    convexId: string;
    sourcePath: string;
}

export interface ExistingLesson {
    convexId: string;
    sourcePath: string;
    sourceHash: string;
}

export interface ImportPlan {
    modulesToCreate: ParsedModule[];
    modulesToUpdate: Array<{ convexId: string; sourcePath: string; title: string; order: number }>;
    modulesToDelete: string[]; // convexIds
    lessonsToCreate: Array<{ moduleSourcePath: string; lesson: ParsedLesson }>;
    lessonsToUpdate: Array<{ convexId: string; lesson: ParsedLesson }>;
    lessonsToSkip: number;
    lessonsToDelete: string[]; // convexIds
}

export interface ImportPlanSummary {
    modulesToCreate: number;
    modulesToUpdate: number;
    modulesToDelete: number;
    lessonsToCreate: number;
    lessonsToUpdate: number;
    lessonsToSkip: number;
    lessonsToDelete: number;
}

export function summarizePlan(plan: ImportPlan): ImportPlanSummary {
    return {
        modulesToCreate: plan.modulesToCreate.length,
        modulesToUpdate: plan.modulesToUpdate.length,
        modulesToDelete: plan.modulesToDelete.length,
        lessonsToCreate: plan.lessonsToCreate.length,
        lessonsToUpdate: plan.lessonsToUpdate.length,
        lessonsToSkip: plan.lessonsToSkip,
        lessonsToDelete: plan.lessonsToDelete.length,
    };
}
```

- [ ] **Step 3: Write `lib/courseImport/parse.ts`**

```ts
import matter from 'gray-matter';
import { load as loadYaml } from 'js-yaml';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import { createHash } from 'crypto';
import {
    LESSON_TYPES,
    type LessonType,
    type ParsedCourse,
    type ParsedModule,
    type ParsedLesson,
    type RepoFile,
} from './types';

interface RawCourseYaml {
    title?: string;
    description?: string;
    duration?: string;
    level?: string;
    startDate?: string;
    icon?: string;
    color?: string;
    enableChecklist?: boolean;
    enableRanking?: boolean;
}

interface RawModuleYaml {
    title?: string;
}

interface RawExamQuestion {
    text?: string;
    options?: Array<{ text?: string; correct?: boolean }>;
}

interface RawExamYaml {
    title?: string;
    type?: string;
    settings?: { duration?: number };
    questions?: RawExamQuestion[];
}

const REQUIRED_COURSE_FIELDS = ['title', 'description', 'duration', 'level', 'startDate'] as const;

function computeHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

function markdownToHtml(markdown: string): string {
    return String(remark().use(remarkHtml).processSync(markdown));
}

function titleCase(slug: string): string {
    return slug
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripNumericPrefix(name: string): { order: number; slugTitle: string } {
    const match = name.match(/^(\d+)-(.+)$/);
    if (!match) {
        return { order: 0, slugTitle: titleCase(name) };
    }
    return { order: parseInt(match[1], 10), slugTitle: titleCase(match[2]) };
}

function stripExtension(fileName: string): string {
    return fileName.replace(/\.(md|ya?ml)$/i, '');
}

export function parseCourseTree(files: RepoFile[], basePath: string): ParsedCourse {
    const normalizedBase = basePath.replace(/^\/+|\/+$/g, '');
    const prefix = normalizedBase ? `${normalizedBase}/` : '';

    const scoped = files
        .filter((f) => f.path.startsWith(prefix))
        .map((f) => ({ ...f, relPath: f.path.slice(prefix.length) }));

    const courseFile = scoped.find((f) => f.relPath === 'course.yaml');
    if (!courseFile) {
        throw new Error(`No se encontró course.yaml en "${basePath || '/'}"`);
    }

    const course = (loadYaml(courseFile.content) ?? {}) as RawCourseYaml;
    for (const field of REQUIRED_COURSE_FIELDS) {
        if (!course[field]) {
            throw new Error(`course.yaml: falta el campo requerido "${field}"`);
        }
    }

    const moduleFiles = scoped.filter((f) => f.relPath.startsWith('modules/'));
    const moduleFolders = new Map<string, typeof scoped>();
    for (const file of moduleFiles) {
        const parts = file.relPath.split('/'); // ['modules', '01-intro', '01-lesson.md']
        if (parts.length < 3) continue; // stray file directly under modules/, ignored
        const folder = parts[1];
        const list = moduleFolders.get(folder) ?? [];
        list.push(file);
        moduleFolders.set(folder, list);
    }

    const modules: ParsedModule[] = Array.from(moduleFolders.entries())
        .map(([folder, filesInFolder]) => parseModule(folder, filesInFolder))
        .sort((a, b) => a.order - b.order);

    return {
        title: course.title as string,
        description: course.description as string,
        duration: course.duration as string,
        level: course.level as string,
        startDate: course.startDate as string,
        icon: course.icon ?? 'code',
        color: course.color ?? 'green',
        enableChecklist: course.enableChecklist !== false,
        enableRanking: course.enableRanking !== false,
        modules,
    };
}

function parseModule(
    folder: string,
    files: Array<{ path: string; content: string; relPath: string }>
): ParsedModule {
    const { order, slugTitle } = stripNumericPrefix(folder);
    const modulePath = `modules/${folder}`;

    const moduleYamlFile = files.find((f) => f.relPath === `${modulePath}/module.yaml`);
    let title = slugTitle;
    if (moduleYamlFile) {
        const parsed = (loadYaml(moduleYamlFile.content) ?? {}) as RawModuleYaml;
        if (parsed.title) title = parsed.title;
    }

    const lessonFiles = files.filter(
        (f) => f.relPath !== `${modulePath}/module.yaml` && f.relPath.startsWith(`${modulePath}/`)
    );

    const lessons = lessonFiles.map(parseLesson).sort((a, b) => a.order - b.order);

    return { sourcePath: modulePath, title, order, lessons };
}

function parseLesson(file: { path: string; content: string; relPath: string }): ParsedLesson {
    const fileName = file.relPath.split('/').pop() as string;
    const { order, slugTitle } = stripNumericPrefix(stripExtension(fileName));
    const sourceHash = computeHash(file.content);
    const isYaml = /\.ya?ml$/i.test(fileName);

    if (isYaml) {
        return parseExamLesson(file.relPath, file.content, order, slugTitle, sourceHash);
    }
    return parseMarkdownLesson(file.relPath, file.content, order, slugTitle, sourceHash);
}

function parseExamLesson(
    relPath: string,
    rawContent: string,
    order: number,
    slugTitle: string,
    sourceHash: string
): ParsedLesson {
    const parsed = (loadYaml(rawContent) ?? {}) as RawExamYaml;
    if (parsed.type !== 'exam') {
        throw new Error(
            `${relPath}: los archivos .yaml de lección solo soportan type: exam (recibido "${String(parsed.type)}")`
        );
    }
    if (!parsed.questions || parsed.questions.length === 0) {
        throw new Error(`${relPath}: el examen debe tener al menos una pregunta`);
    }

    const questions = parsed.questions.map((q, i) => ({
        id: String(i + 1),
        text: q.text ?? '',
        options: (q.options ?? []).map((o, j) => ({
            id: `${i + 1}-${j + 1}`,
            text: o.text ?? '',
            isCorrect: Boolean(o.correct),
        })),
    }));

    const content = JSON.stringify({
        questions,
        settings: { duration: parsed.settings?.duration ?? 15 },
    });

    return {
        sourcePath: relPath,
        title: parsed.title ?? slugTitle,
        type: 'exam',
        order,
        content,
        sourceHash,
    };
}

function parseMarkdownLesson(
    relPath: string,
    rawContent: string,
    order: number,
    slugTitle: string,
    sourceHash: string
): ParsedLesson {
    const { data: frontmatter, content: body } = matter(rawContent);
    const type = frontmatter.type as LessonType | undefined;
    if (!type || !LESSON_TYPES.includes(type) || type === 'exam') {
        throw new Error(
            `${relPath}: type "${String(frontmatter.type)}" no reconocido (esperado uno de: text, video, pdf, podcast)`
        );
    }
    const title = typeof frontmatter.title === 'string' ? frontmatter.title : slugTitle;

    let content: string;
    if (type === 'text') {
        content = JSON.stringify({ html: markdownToHtml(body), imageUrl: '' });
    } else {
        if (!frontmatter.url) {
            throw new Error(`${relPath}: las lecciones de tipo "${type}" requieren "url" en el frontmatter`);
        }
        content = JSON.stringify({
            url: String(frontmatter.url),
            html: body.trim() ? markdownToHtml(body) : '',
        });
    }

    return { sourcePath: relPath, title, type, order, content, sourceHash };
}
```

- [ ] **Step 4: Write `lib/courseImport/parse.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseCourseTree } from './parse';
import type { RepoFile } from './types';

function files(entries: Record<string, string>): RepoFile[] {
    return Object.entries(entries).map(([path, content]) => ({ path, content }));
}

const COURSE_YAML = `
title: "Bootcamp de Prueba"
description: "Un curso de prueba"
duration: "4 semanas"
level: "Intermedio"
startDate: "2026-09-01"
icon: "database"
color: "blue"
`;

describe('parseCourseTree', () => {
    it('parses course.yaml and derives order/title from numeric prefixes', () => {
        const result = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-introduccion/01-bienvenida.md': '---\ntitle: Bienvenida\ntype: text\n---\n\nHola',
            }),
            ''
        );

        expect(result.title).toBe('Bootcamp de Prueba');
        expect(result.icon).toBe('database');
        expect(result.modules).toHaveLength(1);
        expect(result.modules[0].sourcePath).toBe('modules/01-introduccion');
        expect(result.modules[0].order).toBe(1);
        expect(result.modules[0].title).toBe('Introduccion');
        expect(result.modules[0].lessons).toHaveLength(1);
        expect(result.modules[0].lessons[0].title).toBe('Bienvenida');
    });

    it('respects module.yaml title override', () => {
        const result = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-intro/module.yaml': 'title: "Título Personalizado"',
                'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
            }),
            ''
        );
        expect(result.modules[0].title).toBe('Título Personalizado');
    });

    it('converts a text lesson body from markdown to HTML', () => {
        const result = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\n# Título\n\nParrafo.',
            }),
            ''
        );
        const content = JSON.parse(result.modules[0].lessons[0].content);
        expect(content.html).toContain('<h1>Título</h1>');
        expect(content.imageUrl).toBe('');
    });

    it('produces { url, html } for a video lesson', () => {
        const result = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-intro/01-a.md':
                    '---\ntitle: Video\ntype: video\nurl: "https://example.com/v.mp4"\n---\n\nDescripcion.',
            }),
            ''
        );
        const content = JSON.parse(result.modules[0].lessons[0].content);
        expect(content.url).toBe('https://example.com/v.mp4');
        expect(content.html).toContain('Descripcion');
    });

    it('throws when a video lesson is missing url', () => {
        expect(() =>
            parseCourseTree(
                files({
                    'course.yaml': COURSE_YAML,
                    'modules/01-intro/01-a.md': '---\ntitle: Video\ntype: video\n---\n\nX',
                }),
                ''
            )
        ).toThrow('requieren "url"');
    });

    it('produces { questions, settings } for an exam lesson', () => {
        const result = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-intro/01-quiz.yaml': `
title: "Quiz"
type: exam
settings:
  duration: 20
questions:
  - text: "Pregunta 1"
    options:
      - text: "A"
        correct: true
      - text: "B"
        correct: false
`,
            }),
            ''
        );
        const content = JSON.parse(result.modules[0].lessons[0].content);
        expect(content.settings.duration).toBe(20);
        expect(content.questions).toHaveLength(1);
        expect(content.questions[0].options[0].isCorrect).toBe(true);
    });

    it('throws on an unrecognized lesson type instead of silently dropping it', () => {
        expect(() =>
            parseCourseTree(
                files({
                    'course.yaml': COURSE_YAML,
                    'modules/01-intro/01-a.md': '---\ntitle: X\ntype: subtitle\n---\n\nX',
                }),
                ''
            )
        ).toThrow('no reconocido');
    });

    it('throws when course.yaml is missing', () => {
        expect(() => parseCourseTree(files({}), '')).toThrow('course.yaml');
    });

    it('throws when a required course.yaml field is missing', () => {
        expect(() =>
            parseCourseTree(files({ 'course.yaml': 'title: "Solo título"' }), '')
        ).toThrow('description');
    });

    it('scopes parsing to the given basePath', () => {
        const result = parseCourseTree(
            files({
                'other-course/course.yaml': 'title: Ignorar\ndescription: x\nduration: x\nlevel: x\nstartDate: x',
                'cursos/data-eng/course.yaml': COURSE_YAML,
                'cursos/data-eng/modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
            }),
            'cursos/data-eng'
        );
        expect(result.title).toBe('Bootcamp de Prueba');
    });

    it('produces a stable hash for identical content and a different one when content changes', () => {
        const a = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
            }),
            ''
        );
        const b = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nX',
            }),
            ''
        );
        const c = parseCourseTree(
            files({
                'course.yaml': COURSE_YAML,
                'modules/01-intro/01-a.md': '---\ntitle: A\ntype: text\n---\n\nY',
            }),
            ''
        );
        expect(a.modules[0].lessons[0].sourceHash).toBe(b.modules[0].lessons[0].sourceHash);
        expect(a.modules[0].lessons[0].sourceHash).not.toBe(c.modules[0].lessons[0].sourceHash);
    });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run lib/courseImport/parse.test.ts
```

Expected: all passing (12 tests).

- [ ] **Step 6: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint lib/courseImport/types.ts lib/courseImport/parse.ts lib/courseImport/parse.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add lib/courseImport/types.ts lib/courseImport/parse.ts lib/courseImport/parse.test.ts package.json package-lock.json
git commit -m "feat: add course-import parsing library (course.yaml/module.yaml/lessons)"
```

---

### Task 4: GitHub fetch client

**Files:**
- Create: `lib/courseImport/github.ts`
- Create: `lib/courseImport/github.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `fetchRepoFiles(owner, repo, ref, basePath, pat): Promise<RepoFile[]>`,
  `parseRepoUrl(repoUrl: string): { owner: string; repo: string }` —
  consumed by Task 7's server actions.

- [ ] **Step 1: Write `lib/courseImport/github.ts`**

```ts
import 'server-only';
import type { RepoFile } from './types';

interface GitTreeEntry {
    path: string;
    type: 'blob' | 'tree';
    sha: string;
}

interface GitTreeResponse {
    tree: GitTreeEntry[];
    truncated: boolean;
}

interface GitBlobResponse {
    content: string;
    encoding: string;
}

async function githubFetch(path: string, pat: string): Promise<Response> {
    const response = await fetch(`https://api.github.com${path}`, {
        headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!response.ok) {
        // Deliberately never include the Authorization header or the PAT
        // itself in this message -- it can end up in lastSyncError.
        throw new Error(
            `GitHub respondió ${response.status} para ${path}. Verifica el token (permisos, expiración) y que el repositorio/rama existan.`
        );
    }
    return response;
}

export async function fetchRepoFiles(
    owner: string,
    repo: string,
    ref: string,
    basePath: string,
    pat: string
): Promise<RepoFile[]> {
    const treeResponse = await githubFetch(
        `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
        pat
    );
    const tree = (await treeResponse.json()) as GitTreeResponse;

    if (tree.truncated) {
        throw new Error(
            'El árbol del repositorio es demasiado grande para listarse en una sola llamada. Reduce el tamaño del repositorio o del curso.'
        );
    }

    const normalizedBase = basePath.replace(/^\/+|\/+$/g, '');
    const prefix = normalizedBase ? `${normalizedBase}/` : '';

    const blobs = tree.tree.filter(
        (entry) => entry.type === 'blob' && (prefix === '' || entry.path.startsWith(prefix))
    );

    if (blobs.length === 0) {
        throw new Error(`No se encontraron archivos en "${basePath || '/'}" para ${owner}/${repo}@${ref}.`);
    }

    return Promise.all(
        blobs.map(async (entry) => {
            const blobResponse = await githubFetch(`/repos/${owner}/${repo}/git/blobs/${entry.sha}`, pat);
            const blob = (await blobResponse.json()) as GitBlobResponse;
            const content =
                blob.encoding === 'base64' ? Buffer.from(blob.content, 'base64').toString('utf8') : blob.content;
            return { path: entry.path, content };
        })
    );
}

export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const trimmed = repoUrl.trim().replace(/\.git$/, '').replace(/\/+$/, '');
    const match = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)$/) ?? trimmed.match(/^([^/]+)\/([^/]+)$/);
    if (!match) {
        throw new Error(`No se pudo interpretar la URL del repositorio: "${repoUrl}". Usa "owner/repo" o una URL de GitHub.`);
    }
    return { owner: match[1], repo: match[2] };
}
```

- [ ] **Step 2: Write `lib/courseImport/github.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRepoFiles, parseRepoUrl } from './github';

const originalFetch = global.fetch;

beforeEach(() => {
    global.fetch = vi.fn();
});

afterEach(() => {
    global.fetch = originalFetch;
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => body,
    } as Response;
}

describe('fetchRepoFiles', () => {
    it('fetches the tree, then each blob under the base path, and decodes base64 content', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes('/git/trees/')) {
                return jsonResponse({
                    truncated: false,
                    tree: [
                        { path: 'cursos/x/course.yaml', type: 'blob', sha: 'sha1' },
                        { path: 'cursos/x/README.md', type: 'blob', sha: 'sha2' },
                        { path: 'other-course/course.yaml', type: 'blob', sha: 'sha3' },
                        { path: 'cursos/x/modules', type: 'tree', sha: 'sha4' },
                    ],
                });
            }
            if (url.endsWith('/git/blobs/sha1')) {
                return jsonResponse({ content: Buffer.from('title: X').toString('base64'), encoding: 'base64' });
            }
            if (url.endsWith('/git/blobs/sha2')) {
                return jsonResponse({ content: Buffer.from('# readme').toString('base64'), encoding: 'base64' });
            }
            throw new Error(`unexpected url ${url}`);
        });

        const files = await fetchRepoFiles('owner', 'repo', 'main', 'cursos/x', 'token123');

        expect(files).toHaveLength(2);
        expect(files.find((f) => f.path === 'cursos/x/course.yaml')?.content).toBe('title: X');
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/repos/owner/repo/git/trees/main?recursive=1'),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token123' }) })
        );
    });

    it('throws a sanitized error on a non-ok response, never including the token', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue(jsonResponse({}, false, 401));

        await expect(fetchRepoFiles('owner', 'repo', 'main', '', 'super-secret-token')).rejects.toThrow(/401/);
        try {
            await fetchRepoFiles('owner', 'repo', 'main', '', 'super-secret-token');
        } catch (err) {
            expect(String(err)).not.toContain('super-secret-token');
        }
    });

    it('throws when the tree is truncated', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue(jsonResponse({ truncated: true, tree: [] }));

        await expect(fetchRepoFiles('owner', 'repo', 'main', '', 'token')).rejects.toThrow('demasiado grande');
    });

    it('throws when no files are found under the base path', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue(jsonResponse({ truncated: false, tree: [] }));

        await expect(fetchRepoFiles('owner', 'repo', 'main', 'cursos/x', 'token')).rejects.toThrow(
            'No se encontraron archivos'
        );
    });
});

describe('parseRepoUrl', () => {
    it('parses "owner/repo" shorthand', () => {
        expect(parseRepoUrl('CleveritDemo/mi-curso')).toEqual({ owner: 'CleveritDemo', repo: 'mi-curso' });
    });

    it('parses an https GitHub URL', () => {
        expect(parseRepoUrl('https://github.com/CleveritDemo/mi-curso')).toEqual({
            owner: 'CleveritDemo',
            repo: 'mi-curso',
        });
    });

    it('parses an https GitHub URL with a trailing .git', () => {
        expect(parseRepoUrl('https://github.com/CleveritDemo/mi-curso.git')).toEqual({
            owner: 'CleveritDemo',
            repo: 'mi-curso',
        });
    });

    it('parses an ssh GitHub URL', () => {
        expect(parseRepoUrl('git@github.com:CleveritDemo/mi-curso.git')).toEqual({
            owner: 'CleveritDemo',
            repo: 'mi-curso',
        });
    });

    it('throws on an unrecognized format', () => {
        expect(() => parseRepoUrl('not a url at all')).toThrow('No se pudo interpretar');
    });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run lib/courseImport/github.test.ts
```

Expected: all passing (9 tests).

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint lib/courseImport/github.ts lib/courseImport/github.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/courseImport/github.ts lib/courseImport/github.test.ts
git commit -m "feat: add GitHub Git Trees/Blobs fetch client for course-import"
```

---

### Task 5: Diff/plan computation

**Files:**
- Create: `lib/courseImport/diff.ts`
- Create: `lib/courseImport/diff.test.ts`

**Interfaces:**
- Consumes: `ParsedCourse`, `ExistingModule`, `ExistingLesson`,
  `ImportPlan` types from Task 3.
- Produces: `computePlan(parsed, existingModules, existingLessons): ImportPlan`
  — consumed by Task 7's server actions.

- [ ] **Step 1: Write `lib/courseImport/diff.ts`**

```ts
import type { ExistingLesson, ExistingModule, ImportPlan, ParsedCourse } from './types';

export function computePlan(
    parsed: ParsedCourse,
    existingModules: ExistingModule[],
    existingLessons: ExistingLesson[]
): ImportPlan {
    const existingModuleByPath = new Map(existingModules.map((m) => [m.sourcePath, m]));
    const parsedModulePaths = new Set(parsed.modules.map((m) => m.sourcePath));

    const modulesToCreate = parsed.modules.filter((m) => !existingModuleByPath.has(m.sourcePath));
    const modulesToUpdate = parsed.modules
        .filter((m) => existingModuleByPath.has(m.sourcePath))
        .map((m) => ({
            convexId: existingModuleByPath.get(m.sourcePath)!.convexId,
            sourcePath: m.sourcePath,
            title: m.title,
            order: m.order,
        }));
    const modulesToDelete = existingModules
        .filter((m) => !parsedModulePaths.has(m.sourcePath))
        .map((m) => m.convexId);

    const existingLessonByPath = new Map(existingLessons.map((l) => [l.sourcePath, l]));
    const parsedLessonPaths = new Set<string>();

    const lessonsToCreate: ImportPlan['lessonsToCreate'] = [];
    const lessonsToUpdate: ImportPlan['lessonsToUpdate'] = [];
    let lessonsToSkip = 0;

    for (const mod of parsed.modules) {
        for (const lesson of mod.lessons) {
            parsedLessonPaths.add(lesson.sourcePath);
            const existing = existingLessonByPath.get(lesson.sourcePath);
            if (!existing) {
                lessonsToCreate.push({ moduleSourcePath: mod.sourcePath, lesson });
            } else if (existing.sourceHash !== lesson.sourceHash) {
                lessonsToUpdate.push({ convexId: existing.convexId, lesson });
            } else {
                lessonsToSkip += 1;
            }
        }
    }

    const lessonsToDelete = existingLessons
        .filter((l) => !parsedLessonPaths.has(l.sourcePath))
        .map((l) => l.convexId);

    return {
        modulesToCreate,
        modulesToUpdate,
        modulesToDelete,
        lessonsToCreate,
        lessonsToUpdate,
        lessonsToSkip,
        lessonsToDelete,
    };
}
```

- [ ] **Step 2: Write `lib/courseImport/diff.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computePlan } from './diff';
import type { ParsedCourse } from './types';

function course(modules: ParsedCourse['modules']): ParsedCourse {
    return {
        title: 'T',
        description: 'D',
        duration: '1',
        level: 'Intermedio',
        startDate: '2026-01-01',
        icon: 'code',
        color: 'green',
        enableChecklist: true,
        enableRanking: true,
        modules,
    };
}

describe('computePlan', () => {
    it('treats everything as a create when there is no existing state', () => {
        const plan = computePlan(
            course([
                {
                    sourcePath: 'modules/01-a',
                    title: 'A',
                    order: 1,
                    lessons: [{ sourcePath: 'modules/01-a/01-l.md', title: 'L', type: 'text', order: 1, content: '{}', sourceHash: 'h1' }],
                },
            ]),
            [],
            []
        );
        expect(plan.modulesToCreate).toHaveLength(1);
        expect(plan.lessonsToCreate).toHaveLength(1);
        expect(plan.modulesToUpdate).toHaveLength(0);
        expect(plan.lessonsToSkip).toBe(0);
    });

    it('skips a lesson whose hash is unchanged', () => {
        const plan = computePlan(
            course([
                {
                    sourcePath: 'modules/01-a',
                    title: 'A',
                    order: 1,
                    lessons: [{ sourcePath: 'modules/01-a/01-l.md', title: 'L', type: 'text', order: 1, content: '{}', sourceHash: 'h1' }],
                },
            ]),
            [{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
            [{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
        );
        expect(plan.lessonsToSkip).toBe(1);
        expect(plan.lessonsToCreate).toHaveLength(0);
        expect(plan.lessonsToUpdate).toHaveLength(0);
    });

    it('updates a lesson whose hash changed', () => {
        const plan = computePlan(
            course([
                {
                    sourcePath: 'modules/01-a',
                    title: 'A',
                    order: 1,
                    lessons: [{ sourcePath: 'modules/01-a/01-l.md', title: 'L', type: 'text', order: 1, content: '{}', sourceHash: 'h2' }],
                },
            ]),
            [{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
            [{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
        );
        expect(plan.lessonsToUpdate).toEqual([
            { convexId: 'les1', lesson: expect.objectContaining({ sourceHash: 'h2' }) },
        ]);
    });

    it('deletes a module and its lessons no longer present in the repo', () => {
        const plan = computePlan(
            course([]),
            [{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
            [{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
        );
        expect(plan.modulesToDelete).toEqual(['mod1']);
        expect(plan.lessonsToDelete).toEqual(['les1']);
    });

    it('deletes one lesson within a module that otherwise still exists', () => {
        const plan = computePlan(
            course([{ sourcePath: 'modules/01-a', title: 'A', order: 1, lessons: [] }]),
            [{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
            [{ convexId: 'les1', sourcePath: 'modules/01-a/01-l.md', sourceHash: 'h1' }]
        );
        expect(plan.modulesToDelete).toHaveLength(0);
        expect(plan.lessonsToDelete).toEqual(['les1']);
    });

    it('always includes an existing module in modulesToUpdate, even with no field changes', () => {
        const plan = computePlan(
            course([{ sourcePath: 'modules/01-a', title: 'A', order: 1, lessons: [] }]),
            [{ convexId: 'mod1', sourcePath: 'modules/01-a' }],
            []
        );
        expect(plan.modulesToUpdate).toEqual([{ convexId: 'mod1', sourcePath: 'modules/01-a', title: 'A', order: 1 }]);
    });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run lib/courseImport/diff.test.ts
```

Expected: all passing (6 tests).

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint lib/courseImport/diff.ts lib/courseImport/diff.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/courseImport/diff.ts lib/courseImport/diff.test.ts
git commit -m "feat: add plan/diff computation for course-import re-sync"
```

---

### Task 6: Convex course-import functions

**Files:**
- Create: `convex/courseImport.ts`
- Create: `convex/courseImport.test.ts`

**Interfaces:**
- Consumes: `convex/schema.ts` fields from Task 2; reuses
  `api.users.getCurrentUserWithRole` (`convex/users.ts:25-62`) for role
  resolution.
- Produces: `getSyncState`, `getBootcampSyncMeta`, `applyImport`,
  `recordSyncFailure` — consumed by Task 7's server actions.

- [ ] **Step 1: Write `convex/courseImport.ts`**

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Existing modules/lessons for a git-managed bootcamp, keyed by sourcePath,
// for the Next.js server action to diff a freshly-parsed repo tree against.
export const getSyncState = query({
  args: { bootcampId: v.id("bootcamps") },
  handler: async (ctx, args) => {
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_bootcamp", (q) => q.eq("bootcampId", args.bootcampId))
      .collect();

    const lessonsByModule = await Promise.all(
      modules.map((m) =>
        ctx.db
          .query("lessons")
          .withIndex("by_module", (q) => q.eq("moduleId", m._id))
          .collect()
      )
    );

    return {
      modules: modules
        .filter((m) => m.sourcePath)
        .map((m) => ({ convexId: m._id, sourcePath: m.sourcePath as string })),
      lessons: lessonsByModule
        .flat()
        .filter((l) => l.sourcePath && l.sourceHash)
        .map((l) => ({
          convexId: l._id,
          sourcePath: l.sourcePath as string,
          sourceHash: l.sourceHash as string,
        })),
    };
  },
});

// Connection metadata for the "Sync now" flow, including the encrypted PAT.
// Deliberately role-gated inside the handler (unlike most other functions
// in this file's siblings, which leave authorization to the Next.js
// caller) because this is the one query that returns secret material.
export const getBootcampSyncMeta = query({
  args: { bootcampId: v.id("bootcamps") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUserWithRole, {});
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.role !== "docente")) {
      throw new Error("No tienes permisos para ver esta conexión");
    }

    const bootcamp = await ctx.db.get(args.bootcampId);
    if (!bootcamp) return null;

    return {
      sourceRepo: bootcamp.sourceRepo ?? null,
      sourcePath: bootcamp.sourcePath ?? null,
      sourceRef: bootcamp.sourceRef ?? null,
      sourcePatEncrypted: bootcamp.sourcePatEncrypted ?? null,
      lastSyncedAt: bootcamp.lastSyncedAt ?? null,
      lastSyncStatus: bootcamp.lastSyncStatus ?? null,
      lastSyncError: bootcamp.lastSyncError ?? null,
    };
  },
});

export const applyImport = mutation({
  args: {
    bootcampId: v.optional(v.id("bootcamps")),
    course: v.object({
      title: v.string(),
      description: v.string(),
      duration: v.string(),
      level: v.string(),
      startDate: v.string(),
      icon: v.string(),
      color: v.string(),
      enableChecklist: v.boolean(),
      enableRanking: v.boolean(),
    }),
    connection: v.optional(
      v.object({
        sourceRepo: v.string(),
        sourcePath: v.string(),
        sourceRef: v.string(),
        sourcePatEncrypted: v.string(),
      })
    ),
    modulesToCreate: v.array(
      v.object({ sourcePath: v.string(), title: v.string(), order: v.number() })
    ),
    modulesToUpdate: v.array(
      v.object({
        convexId: v.id("modules"),
        sourcePath: v.string(),
        title: v.string(),
        order: v.number(),
      })
    ),
    modulesToDelete: v.array(v.id("modules")),
    lessonsToCreate: v.array(
      v.object({
        moduleSourcePath: v.string(),
        sourcePath: v.string(),
        title: v.string(),
        type: v.string(),
        order: v.number(),
        content: v.string(),
        sourceHash: v.string(),
      })
    ),
    lessonsToUpdate: v.array(
      v.object({
        convexId: v.id("lessons"),
        title: v.string(),
        type: v.string(),
        order: v.number(),
        content: v.string(),
        sourceHash: v.string(),
      })
    ),
    lessonsToDelete: v.array(v.id("lessons")),
  },
  handler: async (ctx, args) => {
    let bootcampId = args.bootcampId;
    if (!bootcampId) {
      if (!args.connection) {
        throw new Error("connection es requerido al crear un bootcamp desde un repositorio");
      }
      bootcampId = await ctx.db.insert("bootcamps", {
        ...args.course,
        ...args.connection,
        students: 0,
        lastSyncedAt: Date.now(),
        lastSyncStatus: "success",
      });
    } else {
      await ctx.db.patch(bootcampId, {
        ...args.course,
        lastSyncedAt: Date.now(),
        lastSyncStatus: "success",
        lastSyncError: undefined,
      });
    }

    // Lessons before modules: modules.remove (see convex/modules.ts) already
    // cascade-deletes its own lessons, so any lesson listed here that
    // belongs to a module also being deleted must go first -- otherwise the
    // module's cascade would have already removed it and this delete would
    // throw "not found".
    for (const lessonId of args.lessonsToDelete) {
      await ctx.db.delete(lessonId);
    }
    for (const moduleId of args.modulesToDelete) {
      await ctx.db.delete(moduleId);
    }

    const moduleIdByPath = new Map<string, Id<"modules">>();
    for (const m of args.modulesToCreate) {
      const id = await ctx.db.insert("modules", {
        bootcampId,
        title: m.title,
        order: m.order,
        sourcePath: m.sourcePath,
      });
      moduleIdByPath.set(m.sourcePath, id);
    }
    for (const m of args.modulesToUpdate) {
      await ctx.db.patch(m.convexId, { title: m.title, order: m.order });
      moduleIdByPath.set(m.sourcePath, m.convexId);
    }

    for (const l of args.lessonsToCreate) {
      const moduleId = moduleIdByPath.get(l.moduleSourcePath);
      if (!moduleId) {
        throw new Error(`No se pudo resolver el módulo para la lección "${l.sourcePath}"`);
      }
      await ctx.db.insert("lessons", {
        moduleId,
        title: l.title,
        type: l.type,
        order: l.order,
        content: l.content,
        sourcePath: l.sourcePath,
        sourceHash: l.sourceHash,
      });
    }
    for (const l of args.lessonsToUpdate) {
      await ctx.db.patch(l.convexId, {
        title: l.title,
        type: l.type,
        order: l.order,
        content: l.content,
        sourceHash: l.sourceHash,
      });
    }

    return { bootcampId };
  },
});

export const recordSyncFailure = mutation({
  args: { bootcampId: v.id("bootcamps"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bootcampId, {
      lastSyncStatus: "error",
      lastSyncError: args.error,
    });
  },
});
```

- [ ] **Step 2: Write `convex/courseImport.test.ts`**

```ts
// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

function newTestContext() {
    return convexTest(schema, import.meta.glob('./**/*.*s'));
}

const COURSE = {
    title: 'Bootcamp Test',
    description: 'D',
    duration: '4 semanas',
    level: 'Intermedio',
    startDate: '2026-01-01',
    icon: 'code',
    color: 'green',
    enableChecklist: true,
    enableRanking: true,
};

const CONNECTION = {
    sourceRepo: 'owner/repo',
    sourcePath: 'cursos/x',
    sourceRef: 'main',
    sourcePatEncrypted: 'iv.tag.ciphertext',
};

describe('applyImport', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('creates a new bootcamp with its modules and lessons', async () => {
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [{ sourcePath: 'modules/01-a', title: 'A', order: 1 }],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [
                {
                    moduleSourcePath: 'modules/01-a',
                    sourcePath: 'modules/01-a/01-l.md',
                    title: 'L',
                    type: 'text',
                    order: 1,
                    content: '{"html":"<p>x</p>","imageUrl":""}',
                    sourceHash: 'h1',
                },
            ],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        const bootcamp = await t.query(api.bootcamps.getById, { id: bootcampId });
        expect(bootcamp?.title).toBe('Bootcamp Test');
        expect(bootcamp?.sourceRepo).toBe('owner/repo');
        expect(bootcamp?.lastSyncStatus).toBe('success');

        const modules = await t.query(api.modules.listByBootcamp, { bootcampId });
        expect(modules).toHaveLength(1);
        expect(modules[0].sourcePath).toBe('modules/01-a');
    });

    it('throws when creating a bootcamp without connection info', async () => {
        await expect(
            t.mutation(api.courseImport.applyImport, {
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [],
                modulesToDelete: [],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToDelete: [],
            })
        ).rejects.toThrow('connection es requerido');
    });

    it('updates an existing bootcamp, module, and lesson on re-sync', async () => {
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [{ sourcePath: 'modules/01-a', title: 'A', order: 1 }],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [
                {
                    moduleSourcePath: 'modules/01-a',
                    sourcePath: 'modules/01-a/01-l.md',
                    title: 'L',
                    type: 'text',
                    order: 1,
                    content: '{"html":"<p>old</p>","imageUrl":""}',
                    sourceHash: 'h1',
                },
            ],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        const modules = await t.query(api.modules.listByBootcamp, { bootcampId });
        const lessons = await t.query(api.lessons.listByModule, { moduleId: modules[0]._id });

        await t.mutation(api.courseImport.applyImport, {
            bootcampId,
            course: { ...COURSE, title: 'Bootcamp Actualizado' },
            modulesToCreate: [],
            modulesToUpdate: [{ convexId: modules[0]._id, sourcePath: 'modules/01-a', title: 'A actualizado', order: 1 }],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [
                {
                    convexId: lessons[0]._id,
                    title: 'L actualizado',
                    type: 'text',
                    order: 1,
                    content: '{"html":"<p>new</p>","imageUrl":""}',
                    sourceHash: 'h2',
                },
            ],
            lessonsToDelete: [],
        });

        const bootcamp = await t.query(api.bootcamps.getById, { id: bootcampId });
        expect(bootcamp?.title).toBe('Bootcamp Actualizado');
        const updatedModules = await t.query(api.modules.listByBootcamp, { bootcampId });
        expect(updatedModules[0].title).toBe('A actualizado');
        const updatedLessons = await t.query(api.lessons.listByModule, { moduleId: modules[0]._id });
        expect(updatedLessons[0].title).toBe('L actualizado');
        expect(updatedLessons[0].sourceHash).toBe('h2');
    });

    it('deletes lessons before modules without throwing when a whole module is removed', async () => {
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [{ sourcePath: 'modules/01-a', title: 'A', order: 1 }],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [
                {
                    moduleSourcePath: 'modules/01-a',
                    sourcePath: 'modules/01-a/01-l.md',
                    title: 'L',
                    type: 'text',
                    order: 1,
                    content: '{}',
                    sourceHash: 'h1',
                },
            ],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        const modules = await t.query(api.modules.listByBootcamp, { bootcampId });
        const lessons = await t.query(api.lessons.listByModule, { moduleId: modules[0]._id });

        await expect(
            t.mutation(api.courseImport.applyImport, {
                bootcampId,
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [],
                modulesToDelete: [modules[0]._id],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToDelete: [lessons[0]._id],
            })
        ).resolves.not.toThrow();

        const remainingModules = await t.query(api.modules.listByBootcamp, { bootcampId });
        expect(remainingModules).toHaveLength(0);
    });
});

describe('getBootcampSyncMeta', () => {
    it('throws when the caller is not authenticated', async () => {
        const t = newTestContext();
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        await expect(t.query(api.courseImport.getBootcampSyncMeta, { bootcampId })).rejects.toThrow(
            'permisos'
        );
    });
});

describe('recordSyncFailure', () => {
    it('records the failure status and message on the bootcamp', async () => {
        const t = newTestContext();
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        await t.mutation(api.courseImport.recordSyncFailure, {
            bootcampId,
            error: 'GitHub respondió 401',
        });

        const bootcamp = await t.query(api.bootcamps.getById, { id: bootcampId });
        expect(bootcamp?.lastSyncStatus).toBe('error');
        expect(bootcamp?.lastSyncError).toBe('GitHub respondió 401');
    });
});
```

Note on coverage: `getBootcampSyncMeta`'s authorized-happy-path (role ===
"docente"/"superadmin") is intentionally verified at the server-action layer
in Task 7, not here — simulating a real Convex Auth identity through
`convex-test` for a role that's resolved via `getCurrentUserWithRole`'s
VIP-email/legacyAuth fallback chain would mostly be re-testing Convex Auth's
own machinery rather than this file's logic. The unauthenticated-rejection
path above *is* this file's own logic (the `!currentUser` check) and is
covered directly.

- [ ] **Step 3: Run tests**

```bash
npx vitest run convex/courseImport.test.ts
```

Expected: all passing (6 tests).

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint convex/courseImport.ts convex/courseImport.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add convex/courseImport.ts convex/courseImport.test.ts
git commit -m "feat: add Convex course-import upsert engine (getSyncState/applyImport)"
```

---

### Task 7: Server actions

**Files:**
- Create: `app/actions/courseImport.ts`
- Create: `app/actions/courseImport.test.ts`

**Interfaces:**
- Consumes: `parseCourseTree` (Task 3), `fetchRepoFiles`/`parseRepoUrl`
  (Task 4), `computePlan` (Task 5), `encryptPat`/`decryptPat` (Task 1),
  `api.courseImport.*` (Task 6), `api.users.getCurrentUserWithRole`.
- Produces: `planImportFromRepo`, `applyImportPlan`, `planResync`,
  `applyResync` — consumed by Tasks 8-9's CMS UI.

- [ ] **Step 1: Write `app/actions/courseImport.ts`**

```ts
'use server';

import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { revalidatePath } from 'next/cache';
import { encryptPat, decryptPat } from '@/utils/crypto';
import { fetchRepoFiles, parseRepoUrl } from '@/lib/courseImport/github';
import { parseCourseTree } from '@/lib/courseImport/parse';
import { computePlan } from '@/lib/courseImport/diff';
import { summarizePlan } from '@/lib/courseImport/types';
import type { ImportPlan, ImportPlanSummary, ParsedCourse } from '@/lib/courseImport/types';

export interface PlanImportResult {
    course: ParsedCourse;
    plan: ImportPlan;
    summary: ImportPlanSummary;
}

async function requireDocenteOrSuperadmin(): Promise<{ token: string }> {
    const token = await convexAuthNextjsToken();
    if (!token) {
        throw new Error('No autorizado');
    }
    const currentUser = await fetchQuery(api.users.getCurrentUserWithRole, {}, { token });
    if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'docente')) {
        throw new Error('No tienes permisos para importar cursos');
    }
    return { token };
}

export async function planImportFromRepo(input: {
    repoUrl: string;
    path: string;
    ref: string;
    pat: string;
}): Promise<{ error: string } | PlanImportResult> {
    try {
        await requireDocenteOrSuperadmin();
        const { owner, repo } = parseRepoUrl(input.repoUrl);
        const files = await fetchRepoFiles(owner, repo, input.ref || 'main', input.path, input.pat);
        const course = parseCourseTree(files, input.path);
        // No existing state on initial import -- everything is a create.
        const plan = computePlan(course, [], []);
        return { course, plan, summary: summarizePlan(plan) };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error al analizar el repositorio' };
    }
}

export async function applyImportPlan(input: {
    course: ParsedCourse;
    plan: ImportPlan;
    connection: { repoUrl: string; path: string; ref: string; pat: string };
}): Promise<{ error: string } | { bootcampId: string }> {
    try {
        const { token } = await requireDocenteOrSuperadmin();
        const { owner, repo } = parseRepoUrl(input.connection.repoUrl);

        const result = await fetchMutation(
            api.courseImport.applyImport,
            {
                course: toApplyCourse(input.course),
                connection: {
                    sourceRepo: `${owner}/${repo}`,
                    sourcePath: input.connection.path,
                    sourceRef: input.connection.ref || 'main',
                    sourcePatEncrypted: encryptPat(input.connection.pat),
                },
                ...toApplyLists(input.plan),
            },
            { token }
        );

        revalidatePath('/cms');
        return { bootcampId: result.bootcampId };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Error al importar el curso' };
    }
}

export async function planResync(bootcampId: string): Promise<{ error: string } | PlanImportResult> {
    try {
        const { token } = await requireDocenteOrSuperadmin();
        const meta = await fetchQuery(api.courseImport.getBootcampSyncMeta, { bootcampId: bootcampId as never }, { token });
        if (!meta || !meta.sourceRepo || !meta.sourcePath || !meta.sourceRef || !meta.sourcePatEncrypted) {
            throw new Error('Este bootcamp no está conectado a un repositorio');
        }

        const [owner, repo] = meta.sourceRepo.split('/');
        const pat = decryptPat(meta.sourcePatEncrypted);
        const files = await fetchRepoFiles(owner, repo, meta.sourceRef, meta.sourcePath, pat);
        const course = parseCourseTree(files, meta.sourcePath);

        const syncState = await fetchQuery(api.courseImport.getSyncState, { bootcampId: bootcampId as never }, { token });
        const plan = computePlan(course, syncState.modules, syncState.lessons);

        return { course, plan, summary: summarizePlan(plan) };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al sincronizar el curso';
        await tryRecordFailure(bootcampId, message);
        return { error: message };
    }
}

export async function applyResync(input: {
    bootcampId: string;
    course: ParsedCourse;
    plan: ImportPlan;
}): Promise<{ error: string } | { bootcampId: string }> {
    try {
        const { token } = await requireDocenteOrSuperadmin();
        const result = await fetchMutation(
            api.courseImport.applyImport,
            {
                bootcampId: input.bootcampId as never,
                course: toApplyCourse(input.course),
                ...toApplyLists(input.plan),
            },
            { token }
        );
        revalidatePath(`/cms/bootcamp/${input.bootcampId}/manage`);
        return { bootcampId: result.bootcampId };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al importar el curso';
        await tryRecordFailure(input.bootcampId, message);
        return { error: message };
    }
}

async function tryRecordFailure(bootcampId: string, message: string): Promise<void> {
    try {
        const token = await convexAuthNextjsToken();
        if (!token) return;
        await fetchMutation(api.courseImport.recordSyncFailure, { bootcampId: bootcampId as never, error: message }, { token });
    } catch {
        // Best-effort -- if even recording the failure fails, the caller
        // already has the error message to show.
    }
}

function toApplyCourse(course: ParsedCourse) {
    return {
        title: course.title,
        description: course.description,
        duration: course.duration,
        level: course.level,
        startDate: course.startDate,
        icon: course.icon,
        color: course.color,
        enableChecklist: course.enableChecklist,
        enableRanking: course.enableRanking,
    };
}

function toApplyLists(plan: ImportPlan) {
    return {
        modulesToCreate: plan.modulesToCreate.map((m) => ({ sourcePath: m.sourcePath, title: m.title, order: m.order })),
        modulesToUpdate: plan.modulesToUpdate.map((m) => ({
            convexId: m.convexId as never,
            sourcePath: m.sourcePath,
            title: m.title,
            order: m.order,
        })),
        modulesToDelete: plan.modulesToDelete.map((id) => id as never),
        lessonsToCreate: plan.lessonsToCreate.map((l) => ({
            moduleSourcePath: l.moduleSourcePath,
            sourcePath: l.lesson.sourcePath,
            title: l.lesson.title,
            type: l.lesson.type,
            order: l.lesson.order,
            content: l.lesson.content,
            sourceHash: l.lesson.sourceHash,
        })),
        lessonsToUpdate: plan.lessonsToUpdate.map((l) => ({
            convexId: l.convexId as never,
            title: l.lesson.title,
            type: l.lesson.type,
            order: l.lesson.order,
            content: l.lesson.content,
            sourceHash: l.lesson.sourceHash,
        })),
        lessonsToDelete: plan.lessonsToDelete.map((id) => id as never),
    };
}
```

Note: `as never` casts on plain-string Convex IDs are necessary because
`ImportPlan`'s `convexId`/`*ToDelete` fields are typed as `string` (Task 3
deliberately keeps `lib/courseImport` free of any Convex-generated type
import, since it's meant to be pure/framework-agnostic), while
`api.courseImport.applyImport`'s generated args type expects branded
`Id<"modules">`/`Id<"lessons">`/`Id<"bootcamps">`. The values themselves are
exactly the strings Convex gave out via `getSyncState`/`applyImport`'s own
return values, so this is a type-level formality, not a runtime risk.

- [ ] **Step 2: Write `app/actions/courseImport.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchQuery = vi.fn();
const fetchMutation = vi.fn();
vi.mock('convex/nextjs', () => ({
    fetchQuery: (...args: unknown[]) => fetchQuery(...args),
    fetchMutation: (...args: unknown[]) => fetchMutation(...args),
}));

const convexAuthNextjsToken = vi.fn();
vi.mock('@convex-dev/auth/nextjs/server', () => ({
    convexAuthNextjsToken: () => convexAuthNextjsToken(),
}));

vi.mock('@/convex/_generated/api', () => ({
    api: {
        users: { getCurrentUserWithRole: 'users.getCurrentUserWithRole' },
        courseImport: {
            getBootcampSyncMeta: 'courseImport.getBootcampSyncMeta',
            getSyncState: 'courseImport.getSyncState',
            applyImport: 'courseImport.applyImport',
            recordSyncFailure: 'courseImport.recordSyncFailure',
        },
    },
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

vi.mock('@/utils/crypto', () => ({
    encryptPat: (pat: string) => `encrypted(${pat})`,
    decryptPat: (encoded: string) => encoded.replace(/^encrypted\(/, '').replace(/\)$/, ''),
}));

const fetchRepoFiles = vi.fn();
const parseRepoUrl = vi.fn();
vi.mock('@/lib/courseImport/github', () => ({
    fetchRepoFiles: (...args: unknown[]) => fetchRepoFiles(...args),
    parseRepoUrl: (...args: unknown[]) => parseRepoUrl(...args),
}));

const COURSE = {
    title: 'T', description: 'D', duration: '1', level: 'Intermedio', startDate: '2026-01-01',
    icon: 'code', color: 'green', enableChecklist: true, enableRanking: true,
    modules: [{ sourcePath: 'modules/01-a', title: 'A', order: 1, lessons: [] }],
};

const { planImportFromRepo, applyImportPlan, planResync } = await import('./courseImport');

beforeEach(() => {
    fetchQuery.mockReset();
    fetchMutation.mockReset();
    convexAuthNextjsToken.mockReset();
    revalidatePath.mockReset();
    fetchRepoFiles.mockReset();
    parseRepoUrl.mockReset();
});

describe('planImportFromRepo', () => {
    it('returns an error when not authenticated', async () => {
        convexAuthNextjsToken.mockResolvedValue(null);
        const result = await planImportFromRepo({ repoUrl: 'o/r', path: '', ref: 'main', pat: 'x' });
        expect(result).toEqual({ error: 'No autorizado' });
    });

    it('returns an error when the caller is an alumno', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'alumno' });
        const result = await planImportFromRepo({ repoUrl: 'o/r', path: '', ref: 'main', pat: 'x' });
        expect('error' in result && result.error).toContain('permisos');
    });

    it('fetches, parses, and returns a create-only plan for a docente', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'docente' });
        parseRepoUrl.mockReturnValue({ owner: 'o', repo: 'r' });
        fetchRepoFiles.mockResolvedValue([
            { path: 'course.yaml', content: 'title: T\ndescription: D\nduration: "1"\nlevel: Intermedio\nstartDate: "2026-01-01"' },
        ]);

        const result = await planImportFromRepo({ repoUrl: 'o/r', path: '', ref: 'main', pat: 'secret' });

        expect('summary' in result).toBe(true);
        expect(fetchRepoFiles).toHaveBeenCalledWith('o', 'r', 'main', '', 'secret');
    });
});

describe('applyImportPlan', () => {
    it('encrypts the PAT before sending it to Convex', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'docente' });
        parseRepoUrl.mockReturnValue({ owner: 'o', repo: 'r' });
        fetchMutation.mockResolvedValue({ bootcampId: 'bc1' });

        const result = await applyImportPlan({
            course: COURSE,
            plan: {
                modulesToCreate: COURSE.modules,
                modulesToUpdate: [],
                modulesToDelete: [],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToSkip: 0,
                lessonsToDelete: [],
            },
            connection: { repoUrl: 'o/r', path: 'cursos/x', ref: 'main', pat: 'super-secret' },
        });

        expect(result).toEqual({ bootcampId: 'bc1' });
        const callArgs = fetchMutation.mock.calls[0][1];
        expect(callArgs.connection.sourcePatEncrypted).toBe('encrypted(super-secret)');
        expect(callArgs.connection.sourcePatEncrypted).not.toContain('super-secret)');
        expect(revalidatePath).toHaveBeenCalledWith('/cms');
    });
});

describe('planResync', () => {
    it('errors clearly when the bootcamp has no repo connection', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockImplementation((fn: string) => {
            if (fn === 'users.getCurrentUserWithRole') return Promise.resolve({ role: 'docente' });
            if (fn === 'courseImport.getBootcampSyncMeta') return Promise.resolve(null);
            return Promise.resolve(null);
        });

        const result = await planResync('bc1');
        expect('error' in result && result.error).toContain('no está conectado');
    });

    it('decrypts the stored PAT before calling GitHub', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockImplementation((fn: string) => {
            if (fn === 'users.getCurrentUserWithRole') return Promise.resolve({ role: 'docente' });
            if (fn === 'courseImport.getBootcampSyncMeta') {
                return Promise.resolve({
                    sourceRepo: 'o/r',
                    sourcePath: 'cursos/x',
                    sourceRef: 'main',
                    sourcePatEncrypted: 'encrypted(stored-secret)',
                });
            }
            if (fn === 'courseImport.getSyncState') return Promise.resolve({ modules: [], lessons: [] });
            return Promise.resolve(null);
        });
        fetchRepoFiles.mockResolvedValue([
            { path: 'cursos/x/course.yaml', content: 'title: T\ndescription: D\nduration: "1"\nlevel: Intermedio\nstartDate: "2026-01-01"' },
        ]);

        const result = await planResync('bc1');

        expect(fetchRepoFiles).toHaveBeenCalledWith('o', 'r', 'main', 'cursos/x', 'stored-secret');
        expect('summary' in result).toBe(true);
    });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run app/actions/courseImport.test.ts
```

Expected: all passing (7 tests).

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint app/actions/courseImport.ts app/actions/courseImport.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/actions/courseImport.ts app/actions/courseImport.test.ts
git commit -m "feat: add course-import server actions (plan/apply, role-gated)"
```

---

### Task 8: CMS UI — "Add course from repo"

**Files:**
- Create: `app/cms/bootcamp/create-from-repo/page.tsx`
- Modify: `app/cms/page.tsx` (or its client component, whichever currently
  renders the "Crear bootcamp" button — confirm exact file with
  `grep -rn "bootcamp/create" app/cms/page.tsx app/cms/*.tsx` before editing)

**Interfaces:**
- Consumes: `planImportFromRepo`, `applyImportPlan` (Task 7).

- [ ] **Step 1: Write `app/cms/bootcamp/create-from-repo/page.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { useSidebar } from '@/components/sidebar-context';
import { MobileMenuButton } from '@/components/mobile-menu-button';
import { Loader2, GitBranch, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { planImportFromRepo, applyImportPlan } from '@/app/actions/courseImport';
import type { PlanImportResult } from '@/app/actions/courseImport';

export default function CreateCourseFromRepoPage() {
    const router = useRouter();
    const { isCollapsed } = useSidebar();
    const [isPending, startTransition] = useTransition();
    const [step, setStep] = useState<'form' | 'preview'>('form');
    const [form, setForm] = useState({ repoUrl: '', path: '', ref: 'main', pat: '' });
    const [plan, setPlan] = useState<PlanImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePlan = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const result = await planImportFromRepo(form);
            if ('error' in result) {
                setError(result.error);
                return;
            }
            setPlan(result);
            setStep('preview');
        });
    };

    const handleApply = () => {
        if (!plan) return;
        setError(null);
        startTransition(async () => {
            const result = await applyImportPlan({
                course: plan.course,
                plan: plan.plan,
                connection: form,
            });
            if ('error' in result) {
                setError(result.error);
                return;
            }
            router.push(`/cms/bootcamp/${result.bootcampId}/manage`);
        });
    };

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <main className={`flex-1 transition-all ${isCollapsed ? 'md:ml-16' : 'md:ml-64'} p-6 md:p-10`}>
                <div className="mx-auto max-w-2xl">
                    <div className="mb-8 flex items-center gap-3">
                        <MobileMenuButton />
                        <div>
                            <h1 className="text-2xl font-medium text-foreground">Agregar curso desde repositorio</h1>
                            <p className="mt-1 text-sm text-muted">
                                Conecta un repositorio de GitHub con la estructura de curso.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'form' && (
                        <form onSubmit={handlePlan} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">Repositorio</label>
                                <input
                                    value={form.repoUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
                                    placeholder="owner/repo o https://github.com/owner/repo"
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">
                                    Ruta del curso (opcional si está en la raíz)
                                </label>
                                <input
                                    value={form.path}
                                    onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                                    placeholder="cursos/data-engineering"
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">Rama</label>
                                <input
                                    value={form.ref}
                                    onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))}
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-foreground">Token de acceso (PAT)</label>
                                <input
                                    type="password"
                                    value={form.pat}
                                    onChange={(e) => setForm((f) => ({ ...f, pat: e.target.value }))}
                                    placeholder="github_pat_..."
                                    className="w-full rounded-md border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    required
                                />
                                <p className="mt-1.5 text-xs text-muted">
                                    Usa un token "fine-grained", limitado a este repositorio, con permiso de solo lectura de contenido (Contents: Read-only).
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={isPending}
                                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isPending && <Loader2 size={16} className="animate-spin" />}
                                Analizar repositorio
                            </button>
                        </form>
                    )}

                    {step === 'preview' && plan && (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-border bg-card-bg p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                                    <GitBranch size={16} />
                                    {form.repoUrl} @ {form.ref}
                                </div>
                                <p className="mb-2 text-sm font-medium text-foreground">{plan.course.title}</p>
                                <ul className="space-y-1 text-sm text-muted">
                                    <li>{plan.summary.modulesToCreate} módulos nuevos</li>
                                    <li>{plan.summary.lessonsToCreate} lecciones nuevas</li>
                                    {plan.summary.lessonsToSkip > 0 && (
                                        <li>{plan.summary.lessonsToSkip} lecciones sin cambios</li>
                                    )}
                                </ul>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('form')}
                                    className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-hover-bg"
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={isPending}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-70"
                                >
                                    {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    Confirmar e importar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
```

- [ ] **Step 2: Add the entry point button**

Run `grep -rn "bootcamp/create" app/cms/page.tsx` (or, if `/cms` renders via
a client component like other CMS pages, `app/cms/cms-client.tsx`) to find
the existing "Crear bootcamp" `<Link>`. Add an adjacent link:

```tsx
<Link
    href="/cms/bootcamp/create-from-repo"
    className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-hover-bg"
>
    <GitBranch size={16} />
    Agregar desde repositorio
</Link>
```

placed next to the existing "Crear bootcamp" button, importing `GitBranch`
from `lucide-react` alongside whatever icons that file already imports.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Visit `/cms/bootcamp/create-from-repo` while logged in as a docente/
superadmin — confirm the form renders, and that an invalid repo URL or a
bad PAT surfaces a readable error instead of crashing.

- [ ] **Step 4: Lint**

```bash
npx eslint app/cms/bootcamp/create-from-repo/page.tsx
```

- [ ] **Step 5: Commit**

```bash
git add app/cms/bootcamp/create-from-repo/page.tsx app/cms/page.tsx
git commit -m "feat: add \"Add course from repo\" CMS page"
```

---

### Task 9: CMS UI — "Sync now" panel

**Files:**
- Modify: `app/cms/bootcamp/[id]/manage/manage-client.tsx`
- Modify: `app/cms/bootcamp/[id]/manage/page.tsx` (pass through the new
  `sourceRepo`/`sourcePath`/`sourceRef`/`lastSyncedAt`/`lastSyncStatus`
  fields already present on the `bootcamp` object it fetches — confirm via
  `grep -n "bootcamp" app/cms/bootcamp/\[id\]/manage/page.tsx` whether it
  passes the whole bootcamp record through already; if so, no change is
  needed there since the new schema fields ride along automatically)

**Interfaces:**
- Consumes: `planResync`, `applyResync` (Task 7).

- [ ] **Step 1: Add the connected-repo panel and Sync now flow**

In `manage-client.tsx`, near the top of the component (alongside the other
`useState` declarations), add:

```tsx
import { planResync, applyResync } from '@/app/actions/courseImport';
import type { PlanImportResult } from '@/app/actions/courseImport';
import { GitBranch, RefreshCw } from 'lucide-react';
// ...
const [syncPlan, setSyncPlan] = useState<PlanImportResult | null>(null);
const [isSyncing, startSyncTransition] = useTransition();
const [syncError, setSyncError] = useState<string | null>(null);

const isGitManaged = Boolean(bootcamp.sourceRepo);

const handlePlanSync = () => {
    setSyncError(null);
    startSyncTransition(async () => {
        const result = await planResync(String(bootcamp.id));
        if ('error' in result) {
            setSyncError(result.error);
            return;
        }
        setSyncPlan(result);
    });
};

const handleApplySync = () => {
    if (!syncPlan) return;
    setSyncError(null);
    startSyncTransition(async () => {
        const result = await applyResync({
            bootcampId: String(bootcamp.id),
            course: syncPlan.course,
            plan: syncPlan.plan,
        });
        if ('error' in result) {
            setSyncError(result.error);
            return;
        }
        setSyncPlan(null);
        router.refresh();
    });
};
```

Then, in the JSX, near the top of the manage page's content (after the
bootcamp title header, before the modules list), add:

```tsx
{isGitManaged && (
    <div className="mb-6 rounded-xl border border-border bg-card-bg p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <GitBranch size={16} />
            Conectado a: {bootcamp.sourceRepo} @ {bootcamp.sourcePath || '/'} (rama: {bootcamp.sourceRef})
        </div>
        <p className="mb-3 text-xs text-muted">
            {bootcamp.lastSyncStatus === 'error'
                ? `Última sincronización falló: ${bootcamp.lastSyncError}`
                : bootcamp.lastSyncedAt
                    ? `Última sincronización: ${new Date(bootcamp.lastSyncedAt).toLocaleString('es-ES')}`
                    : 'Aún no sincronizado'}
        </p>

        {syncError && (
            <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
                {syncError}
            </p>
        )}

        {!syncPlan ? (
            <button
                onClick={handlePlanSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover-bg disabled:opacity-70"
            >
                {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sincronizar ahora
            </button>
        ) : (
            <div className="space-y-3">
                <ul className="space-y-1 text-xs text-muted">
                    <li>{syncPlan.summary.modulesToCreate} módulos nuevos, {syncPlan.summary.lessonsToCreate} lecciones nuevas</li>
                    <li>{syncPlan.summary.modulesToUpdate} módulos actualizados, {syncPlan.summary.lessonsToUpdate} lecciones actualizadas</li>
                    {syncPlan.summary.lessonsToDelete > 0 && (
                        <li className="font-medium text-red-500">
                            {syncPlan.summary.lessonsToDelete} lecciones y {syncPlan.summary.modulesToDelete} módulos serán eliminados
                        </li>
                    )}
                </ul>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSyncPlan(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover-bg"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApplySync}
                        disabled={isSyncing}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-70"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        )}

        <p className="mt-3 text-xs text-muted/70">
            Este bootcamp está gestionado desde el repositorio conectado. Los cambios manuales de módulos y lecciones están deshabilitados.
        </p>
    </div>
)}
```

- [ ] **Step 2: Hide manual add-module/add-lesson controls when git-managed**

Find the "Agregar módulo" button and the per-module "Agregar lección"
controls in `manage-client.tsx` (search for `handleCreateModule` and
`setIsCreatingModule`/`setActiveModuleForContent` call sites in the JSX) and
wrap them with `{!isGitManaged && (...)}`.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Open a manually-created bootcamp's manage page — confirm no panel appears
and manual controls still work (regression check). Then, using a bootcamp
created via Task 8's flow against a small real test repo, confirm the panel
appears, "Sincronizar ahora" shows a zero-change plan (nothing changed since
import), and manually editing the test repo + syncing again picks up the
change.

- [ ] **Step 4: Lint**

```bash
npx eslint app/cms/bootcamp/\[id\]/manage/manage-client.tsx
```

- [ ] **Step 5: Commit**

```bash
git add app/cms/bootcamp/\[id\]/manage/manage-client.tsx app/cms/bootcamp/\[id\]/manage/page.tsx
git commit -m "feat: add Sync now panel to bootcamp manage page for git-managed courses"
```

---

### Task 10: Starter template content + download

**Files:**
- Create: `examples/course-template/course.yaml`
- Create: `examples/course-template/modules/01-introduccion/module.yaml`
- Create: `examples/course-template/modules/01-introduccion/01-bienvenida.md`
- Create: `examples/course-template/modules/01-introduccion/02-video-intro.md`
- Create: `examples/course-template/modules/01-introduccion/03-quiz.yaml`
- Create: `examples/course-template/README.md`
- Create: `app/api/courses/template/route.ts`
- Create: `app/api/courses/template/route.test.ts`

**Interfaces:**
- Produces: a downloadable zip of the example content, and the canonical
  fixture a future GitHub template repo should be seeded from (manual,
  outside this codebase — see note at the end of this task).

- [ ] **Step 1: Write the example course content**

`examples/course-template/course.yaml`:

```yaml
title: "Curso de Ejemplo"
description: "Plantilla de ejemplo para crear cursos desde un repositorio."
duration: "1 semana"
level: "Principiante"
startDate: "2026-01-01"
icon: "code"
color: "green"
enableChecklist: true
enableRanking: true
```

`examples/course-template/modules/01-introduccion/module.yaml`:

```yaml
title: "Introducción"
```

`examples/course-template/modules/01-introduccion/01-bienvenida.md`:

```markdown
---
title: "Bienvenida"
type: text
---

# Bienvenida al curso

Este es un ejemplo de lección de texto. Puedes usar **markdown** estándar:
listas, `código`, [enlaces](https://example.com), etc.
```

`examples/course-template/modules/01-introduccion/02-video-intro.md`:

```markdown
---
title: "Video introductorio"
type: video
url: "https://example.com/video-introductorio.mp4"
---

Descripción opcional del video.
```

`examples/course-template/modules/01-introduccion/03-quiz.yaml`:

```yaml
title: "Quiz de introducción"
type: exam
settings:
  duration: 10
questions:
  - text: "¿Qué formato usan las lecciones de texto?"
    options:
      - text: "Markdown"
        correct: true
      - text: "HTML directo"
        correct: false
```

`examples/course-template/README.md`:

```markdown
# Plantilla de curso

Esta carpeta es el punto de partida para crear un curso importable en la
plataforma. Estructura:

- `course.yaml` — metadata del bootcamp (título, descripción, duración, etc.)
- `modules/NN-nombre/` — un módulo por carpeta, numerada para ordenar
  - `module.yaml` (opcional) — título del módulo, si no quieres derivarlo
    del nombre de la carpeta
  - `NN-nombre.md` — lección de texto (`type: text`), video/pdf/podcast
    (`type: video|pdf|podcast` + `url` en el frontmatter)
  - `NN-nombre.yaml` — lección de examen (`type: exam`)

Ver `docs/superpowers/specs/2026-07-25-course-git-import-design.md` en el
repositorio de la plataforma para el formato completo.
```

- [ ] **Step 2: Install a zip library**

```bash
npm install jszip
```

- [ ] **Step 3: Write `app/api/courses/template/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';

const TEMPLATE_FILES = [
    'course.yaml',
    'README.md',
    'modules/01-introduccion/module.yaml',
    'modules/01-introduccion/01-bienvenida.md',
    'modules/01-introduccion/02-video-intro.md',
    'modules/01-introduccion/03-quiz.yaml',
];

export async function GET() {
    const zip = new JSZip();
    const baseDir = path.join(process.cwd(), 'examples', 'course-template');

    for (const relPath of TEMPLATE_FILES) {
        const content = await readFile(path.join(baseDir, relPath), 'utf8');
        zip.file(relPath, content);
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="curso-plantilla.zip"',
        },
    });
}
```

- [ ] **Step 4: Write `app/api/courses/template/route.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { GET } from './route';

describe('GET /api/courses/template', () => {
    it('returns a zip containing course.yaml and the example lessons', async () => {
        const response = await GET();
        expect(response.headers.get('Content-Type')).toBe('application/zip');

        const buffer = Buffer.from(await response.arrayBuffer());
        const zip = await JSZip.loadAsync(buffer);

        expect(Object.keys(zip.files)).toContain('course.yaml');
        expect(Object.keys(zip.files)).toContain('modules/01-introduccion/01-bienvenida.md');

        const courseYaml = await zip.files['course.yaml'].async('string');
        expect(courseYaml).toContain('title: "Curso de Ejemplo"');
    });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run app/api/courses/template/route.test.ts
```

Expected: 1/1 passing.

- [ ] **Step 6: Add a download link in the CMS**

In `app/cms/bootcamp/create-from-repo/page.tsx` (Task 8), add near the PAT
field's help text:

```tsx
<a
    href="/api/courses/template"
    className="mt-2 inline-block text-xs text-primary hover:underline"
>
    Descargar plantilla .zip
</a>
```

- [ ] **Step 7: Type-check and lint**

```bash
npx tsc --noEmit
npx eslint app/api/courses/template/route.ts app/api/courses/template/route.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add examples/course-template app/api/courses/template package.json package-lock.json app/cms/bootcamp/create-from-repo/page.tsx
git commit -m "feat: add downloadable course starter template"
```

**Manual follow-up (not a code task, do outside this plan):** publish
`examples/course-template/`'s contents as a separate GitHub repository and
mark it as a template repository (Settings → Template repository) so
docentes can also use GitHub's native "Use this template" button, per the
spec's Section 6.

---

## Final steps (after all 10 tasks)

- [ ] **Add `PAT_ENCRYPTION_KEY` to both environments' Vault secrets**

```bash
openssl rand -hex 32   # dev key
openssl rand -hex 32   # prod key -- must be a DIFFERENT value than dev
```

Add each as a new key (`PAT_ENCRYPTION_KEY`) in the Vault KV path already
backing `bootcamp-platform-{dev,prod}`'s `ExternalSecret`
(`orbital-k3s-gitops/apps/bootcamp-platform/external-secrets/{dev,prod}.yaml`
— both already `dataFrom: extract` the whole path, so no manifest change is
needed, only the Vault value). This is a manual step for whoever holds Vault
write access (see this session's earlier note: the assistant does not have
a valid Vault token).

- [ ] **Run the full suite**

```bash
npx vitest run
npx tsc --noEmit
npx eslint .
npm run build
```

- [ ] **Manual end-to-end smoke test**

Using a real (or throwaway) test repo shaped per Task 10's template:
1. `npm run dev`, log in as a docente/superadmin.
2. `/cms/bootcamp/create-from-repo` → connect the test repo → confirm the
   plan preview shows the right counts → apply → confirm redirect to the
   new bootcamp's manage page with the right modules/lessons.
3. Edit a lesson in the test repo, push, click "Sincronizar ahora" on the
   manage page → confirm the plan shows exactly one lesson update → apply →
   confirm the platform now reflects the edit.
4. Delete a lesson in the test repo, push, sync again → confirm the plan
   calls out the deletion before applying.

- [ ] **Use `superpowers:finishing-a-development-branch`** to land the work
  (this repo has branch protection on `main` — land via PR from `develop`,
  same as every prior change this session).
