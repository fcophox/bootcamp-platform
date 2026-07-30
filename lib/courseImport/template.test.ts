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
        expect(TEMPLATE_FILES).toContain('course.yaml');
        expect(TEMPLATE_FILES).toContain('modules/01-introduccion/module.yaml');
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
