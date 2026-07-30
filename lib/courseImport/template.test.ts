import { describe, it, expect } from 'vitest';
import { TEMPLATE_COMMIT_MESSAGE, TEMPLATE_FILES, readTemplateFiles, readTemplateFilesAt } from './template';

describe('course template', () => {
    it('every declared template file exists on disk and is non-empty', async () => {
        const files = await readTemplateFiles();

        expect(files).toHaveLength(TEMPLATE_FILES.length);
        for (const file of files) {
            expect(file.content.trim().length).toBeGreaterThan(0);
        }
    });

    it('includes the files the parser needs to build a course', () => {
        // Structural, not path-specific: module folders get renamed as the
        // template evolves, and an assertion on one folder name only tells you
        // the name changed, not whether the template still works. The
        // "is importable" suite below covers the real contract.
        expect(TEMPLATE_FILES).toContain('course.yaml');
        expect(TEMPLATE_FILES.some((f) => /^modules\/[^/]+\/module\.yaml$/.test(f))).toBe(true);
        expect(TEMPLATE_FILES.some((f) => /^modules\/[^/]+\/.+\.md$/.test(f))).toBe(true);
        expect(TEMPLATE_FILES.some((f) => /^modules\/[^/]+\/.+\.ya?ml$/.test(f))).toBe(true);
    });

    it('rebases every path under the configured base path', async () => {
        const files = await readTemplateFilesAt('cursos/data-eng');

        expect(files.map((f) => f.path)).toContain('cursos/data-eng/course.yaml');
        expect(files.every((f) => f.path.startsWith('cursos/data-eng/'))).toBe(true);
    });

    it('leaves paths at the repo root when no base path is given', async () => {
        for (const base of ['', '/', '   ']) {
            const files = await readTemplateFilesAt(base);
            expect(files.map((f) => f.path)).toContain('course.yaml');
        }
    });

    it('tolerates surrounding slashes in the base path', async () => {
        const files = await readTemplateFilesAt('/cursos/x/');

        expect(files.every((f) => f.path.startsWith('cursos/x/'))).toBe(true);
        expect(files.some((f) => f.path.includes('//'))).toBe(false);
    });

    it('uses a conventional-commit style message', () => {
        expect(TEMPLATE_COMMIT_MESSAGE).toMatch(/^chore: /);
    });
});

describe('the shipped template is importable', () => {
    // The template is the only thing external authors ever see, and it is
    // committed straight into their repository. If it does not survive the
    // parser, the very first import they run fails.
    async function parseTemplate() {
        const { parseCourseTree } = await import('./parse');
        return parseCourseTree(await readTemplateFiles(), '');
    }

    it('parses into a course with the documented metadata', async () => {
        const course = await parseTemplate();

        expect(course.title).toBeTruthy();
        expect(course.description).toBeTruthy();
        expect(course.duration).toBeTruthy();
        expect(course.level).toBeTruthy();
        // Unquoted in YAML this becomes a Date and breaks downstream.
        expect(course.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('has more than one module, ordered by their numeric prefix', async () => {
        const course = await parseTemplate();

        expect(course.modules.length).toBeGreaterThan(1);
        const orders = course.modules.map((m) => m.order);
        expect(orders).toEqual([...orders].sort((a, b) => a - b));
        expect(course.modules[0].title).toBe('Fundamentos');
    });

    it('demonstrates every lesson type the parser supports', async () => {
        const course = await parseTemplate();
        const types = new Set(course.modules.flatMap((m) => m.lessons.map((l) => l.type)));

        expect([...types].sort()).toEqual(['exam', 'pdf', 'podcast', 'text', 'video']);
    });

    it('gives linked lessons a url and text lessons rendered html', async () => {
        const course = await parseTemplate();
        const lessons = course.modules.flatMap((m) => m.lessons);

        for (const lesson of lessons.filter((l) => ['video', 'pdf', 'podcast'].includes(l.type))) {
            expect(JSON.parse(lesson.content).url, `${lesson.sourcePath} has no url`).toBeTruthy();
        }
        for (const lesson of lessons.filter((l) => l.type === 'text')) {
            expect(JSON.parse(lesson.content).html, `${lesson.sourcePath} has no html`).toContain('<');
        }
    });

    it('ships an exam with a correct option and a duration', async () => {
        const course = await parseTemplate();
        const exam = course.modules.flatMap((m) => m.lessons).find((l) => l.type === 'exam')!;
        const parsed = JSON.parse(exam.content);

        expect(parsed.questions.length).toBeGreaterThan(0);
        expect(parsed.settings.duration).toBeGreaterThan(0);
        for (const q of parsed.questions) {
            expect(q.options.some((o: { isCorrect: boolean }) => o.isCorrect), q.text).toBe(true);
        }
    });

    it('does not turn the documentation into lessons', async () => {
        const course = await parseTemplate();
        const paths = course.modules.flatMap((m) => m.lessons.map((l) => l.sourcePath));

        // README/AGENTS/SKILL live outside modules/, so the parser must ignore
        // them -- anything inside a module folder WOULD become a lesson.
        expect(paths.some((p) => /README|AGENTS|SKILL/i.test(p))).toBe(false);
        expect(paths.every((p) => p.startsWith('modules/'))).toBe(true);
    });

    it('is fully self-contained — no pointers into the platform repository', async () => {
        for (const file of await readTemplateFiles()) {
            expect(file.content, `${file.path} points at the platform repo`).not.toMatch(
                /docs\/superpowers|repositorio de la plataforma|lib\/courseImport/,
            );
        }
    });

    it('ships author-facing docs and an agent skill', async () => {
        const paths = TEMPLATE_FILES as readonly string[];

        expect(paths).toContain('README.md');
        expect(paths).toContain('AGENTS.md');
        expect(paths.some((p) => p.endsWith('SKILL.md'))).toBe(true);
    });
});
