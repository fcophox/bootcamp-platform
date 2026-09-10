import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { GET } from './route';
import { TEMPLATE_FILES } from '@/lib/courseImport/template';

describe('GET /api/courses/template', () => {
    it('returns a zip containing course.yaml and the example lessons', async () => {
        const response = await GET();
        expect(response.headers.get('Content-Type')).toBe('application/zip');

        const buffer = Buffer.from(await response.arrayBuffer());
        const zip = await JSZip.loadAsync(buffer);

        // Assert against the shared manifest rather than a hardcoded path:
        // the download and the template committed into an author's repo must
        // stay identical, and module folders get renamed as the template
        // evolves. A literal path here only breaks on a rename without telling
        // you whether the two sources still agree.
        const entries = Object.keys(zip.files).filter((name) => !name.endsWith('/'));
        expect(entries.sort()).toEqual([...TEMPLATE_FILES].sort());

        // The docs an external author depends on must actually be in the zip.
        expect(entries).toContain('README.md');
        expect(entries).toContain('AGENTS.md');

        const courseYaml = await zip.files['course.yaml'].async('string');
        expect(courseYaml).toContain('title:');
    });
});
