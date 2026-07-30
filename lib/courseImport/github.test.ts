import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { describeGithubError, fetchRepoFiles, parseRepoUrl } from './github';

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
                        { path: 'cursos/x/assets/diagram.png', type: 'blob', sha: 'sha5' },
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
        // The non-yaml/md blob (a committed image) is scoped under the base
        // path but must never be fetched -- see fetchRepoFiles's filename
        // filter. mockFetch's catch-all throws on any unexpected URL
        // (including /git/blobs/sha5), so this also fails loudly if that
        // filter regresses.
        expect(files.find((f) => f.path === 'cursos/x/assets/diagram.png')).toBeUndefined();
        expect(mockFetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/git/blobs/sha5'),
            expect.anything()
        );
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

describe('describeGithubError', () => {
    const PATH = '/repos/CleveritDemo/ai-engineer-cleverit-course-101/git/trees/main?recursive=1';

    it('explains 409 as an empty repository, not a token problem', () => {
        const message = describeGithubError(409, PATH);

        // Regression: a 409 on an empty repo used to be reported as
        // "Verifica el token", sending people to audit PAT scopes for nothing.
        expect(message).toContain('vacío');
        expect(message).toContain('sin commits');
        expect(message).toContain('No es un problema del token');
        expect(message).not.toMatch(/Verifica el token \(permisos, expiración\)/);
    });

    it('explains that 404 can also mean the token cannot see a private repo', () => {
        const message = describeGithubError(404, PATH);

        expect(message).toContain('No se encontró el repositorio o la rama');
        expect(message).toContain('privado');
    });

    it('distinguishes an invalid/expired token (401) from an under-scoped one (403)', () => {
        expect(describeGithubError(401, PATH)).toContain('expiró');
        expect(describeGithubError(403, PATH)).toContain('permiso suficiente');
        expect(describeGithubError(403, PATH)).toContain('SSO');
    });

    it('flags rate limiting and transient GitHub outages as retryable', () => {
        expect(describeGithubError(429, PATH)).toContain('límite de peticiones');
        expect(describeGithubError(502, PATH)).toContain('temporal');
    });

    it('always names the status and path, and never leaks a token', () => {
        for (const status of [401, 403, 404, 409, 429, 500, 418]) {
            const message = describeGithubError(status, PATH);
            expect(message).toContain(String(status));
            expect(message).toContain(PATH);
            expect(message).not.toMatch(/ghp_|github_pat_|Bearer/);
        }
    });
});
