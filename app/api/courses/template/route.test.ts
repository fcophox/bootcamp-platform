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
