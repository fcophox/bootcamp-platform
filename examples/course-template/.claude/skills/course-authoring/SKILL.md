---
name: course-authoring
description: Use when creating, editing, reordering or reviewing course content in this repository - any change to course.yaml, a module folder, or a lesson file (text, video, pdf, podcast, exam) that the platform imports from Git.
---

# Course authoring

This repository **is** the course. The platform imports these files directly,
so a formatting mistake does not degrade the result — it aborts the whole
import with an error naming one file.

The full format contract is in `AGENTS.md` at the repository root. **Read it
before writing anything.** This skill is the working procedure around it.

## Before you write

1. Read `AGENTS.md` — the complete format reference.
2. Read `course.yaml` and at least two existing lessons. Match their language,
   tone, depth and heading style. A course reads as one voice.
3. List `modules/` and note the numbering already in use.

## Choosing a lesson type

| Content | Type | File | Required |
| --- | --- | --- | --- |
| Written material, exercises, theory | `text` | `.md` | — |
| Hosted video | `video` | `.md` | `url` |
| Slides, worksheets, references | `pdf` | `.md` | `url` |
| Audio, interviews | `podcast` | `.md` | `url` |
| Assessment | `exam` | `.yaml` | ≥1 question |

Default to `text`. Only use a linked type when the material genuinely lives at
a public URL — the repository's binary files are never imported.

## Writing lessons

- **One file per lesson.** Never combine or split.
- **Number with the module's existing scheme** (`01-`, `02-`, ...). Renumber
  the following files when inserting in the middle.
- **Never place anything but lessons and `module.yaml` inside a module
  folder.** Every other `.md`/`.yaml` there is parsed as a lesson and fails.
  Working notes go outside `modules/`.
- **Renaming a file destroys the lesson** and creates a new one, losing learner
  progress. To change only the visible title, edit `title` in the frontmatter
  and leave the filename alone.
- **Invent no fields.** There is no `order`, `slug`, `id`, `tags`, or per-lesson
  `duration`.

## Writing exams

- At least one question; each question at least one option.
- At least one option marked `correct: true`. Several are allowed.
- Write plausible distractors — options that are wrong for a reason a learner
  would actually get wrong, not filler.
- `settings.duration` is minutes (default 15). Scale it to the question count.

## Verify before you finish

Do not report the work as done without running the validation script in
`AGENTS.md` (or checking its checklist by hand). It catches the failures that
would otherwise surface as a broken import for the user:

- missing required `course.yaml` fields, or an unquoted `startDate`
- a non-lesson file inside a module folder
- a `.md` with an invalid `type`, or a linked type missing `url`
- a `.yaml` lesson that is not `type: exam`, has no questions, or has a
  question with no correct option

State what you verified and what the result was. "It should be fine" is not
verification.

## Commit

One commit per coherent pedagogical change, described in those terms — "añade
módulo de evaluación final", not "adds files". The user imports from the
platform afterwards and reviews a preview before confirming.
