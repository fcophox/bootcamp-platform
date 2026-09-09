import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CourseImportEmptyError, commitFiles, describeGithubError, fetchRepoFiles, parseRepoUrl } from './github';

const originalFetch = global.fetch;
const SHA_1 = '1111111111111111111111111111111111111111';
const SHA_2 = '2222222222222222222222222222222222222222';
const SHA_3 = '3333333333333333333333333333333333333333';
const SHA_4 = '4444444444444444444444444444444444444444';
const SHA_5 = '5555555555555555555555555555555555555555';

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
        mockFetch.mockImplementation(async (url: string | URL) => {
            const href = String(url);
            if (href.includes('/git/trees/')) {
                return jsonResponse({
                    truncated: false,
                    tree: [
                        { path: 'cursos/x/course.yaml', type: 'blob', sha: SHA_1 },
                        { path: 'cursos/x/README.md', type: 'blob', sha: SHA_2 },
                        { path: 'other-course/course.yaml', type: 'blob', sha: SHA_3 },
                        { path: 'cursos/x/modules', type: 'tree', sha: SHA_4 },
                        { path: 'cursos/x/assets/diagram.png', type: 'blob', sha: SHA_5 },
                    ],
                });
            }
            if (href.endsWith(`/git/blobs/${SHA_1}`)) {
                return jsonResponse({ content: Buffer.from('title: X').toString('base64'), encoding: 'base64' });
            }
            if (href.endsWith(`/git/blobs/${SHA_2}`)) {
                return jsonResponse({ content: Buffer.from('# readme').toString('base64'), encoding: 'base64' });
            }
            throw new Error(`unexpected url ${href}`);
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
            expect.stringContaining(`/git/blobs/${SHA_5}`),
            expect.anything()
        );
        expect(mockFetch).toHaveBeenCalledWith(
            expect.objectContaining({ href: expect.stringContaining('/repos/owner/repo/git/trees/main?recursive=1') }),
            expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token123' }) })
        );
    });

    it('builds GitHub API requests as validated api.github.com URLs', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockImplementation(async (url: URL) => {
            expect(url).toBeInstanceOf(URL);
            expect(url.origin).toBe('https://api.github.com');
            if (url.pathname.includes('/git/trees/')) {
                return jsonResponse({
                    truncated: false,
                    tree: [{ path: 'course.yaml', type: 'blob', sha: SHA_1 }],
                });
            }
            return jsonResponse({ content: Buffer.from('title: X').toString('base64'), encoding: 'base64' });
        });

        await fetchRepoFiles('owner', 'repo', 'main', '', 'token123');

        expect(mockFetch).toHaveBeenCalled();
    });

    it('rejects invalid repository coordinates before making requests', async () => {
        await expect(fetchRepoFiles('owner', '../repo', 'main', '', 'token123')).rejects.toThrow('Repositorio');
        await expect(fetchRepoFiles('bad/owner', 'repo', 'main', '', 'token123')).rejects.toThrow('Owner');

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects invalid refs before making requests', async () => {
        await expect(fetchRepoFiles('owner', 'repo', '../main', '', 'token123')).rejects.toThrow('Rama');

        expect(global.fetch).not.toHaveBeenCalled();
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

    it('rejects GitHub URLs with invalid owner or repo segments', () => {
        expect(() => parseRepoUrl('https://github.com/bad_owner/mi-curso')).toThrow('Owner');
        expect(() => parseRepoUrl('CleveritDemo/../mi-curso')).toThrow('No se pudo interpretar');
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

describe('empty-repo / empty-path detection', () => {
    it('throws CourseImportEmptyError(kind=repo) on a 409 from the tree call', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({}) } as Response);

        const err = await fetchRepoFiles('o', 'r', 'main', '', 'pat').catch((e) => e);

        expect(err).toBeInstanceOf(CourseImportEmptyError);
        expect(err.kind).toBe('repo');
        expect(err.message).toContain('vacío');
    });

    it('throws CourseImportEmptyError(kind=path) when the path holds no files', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue(
            jsonResponse({ truncated: false, tree: [{ path: 'otro/a.md', type: 'blob', sha: 's' }] })
        );

        const err = await fetchRepoFiles('o', 'r', 'main', 'cursos/x', 'pat').catch((e) => e);

        expect(err).toBeInstanceOf(CourseImportEmptyError);
        expect(err.kind).toBe('path');
    });

    it('does NOT report empty when files exist under the path', async () => {
        // Guard against clobbering: content that exists but parses badly must
        // never surface as "empty", or we would offer to overwrite real work.
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockImplementation(async (url: string | URL) => {
            const href = String(url);
            if (href.includes('/git/trees/')) {
                return jsonResponse({
                    truncated: false,
                    tree: [{ path: 'cursos/x/garbage.yaml', type: 'blob', sha: SHA_1 }],
                });
            }
            return jsonResponse({ content: Buffer.from(': not valid yaml').toString('base64'), encoding: 'base64' });
        });

        const files = await fetchRepoFiles('o', 'r', 'main', 'cursos/x', 'pat');

        expect(files).toHaveLength(1);
    });

    it('still raises a plain error (not empty) for auth failures', async () => {
        const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as Response);

        const err = await fetchRepoFiles('o', 'r', 'main', '', 'pat').catch((e) => e);

        expect(err).not.toBeInstanceOf(CourseImportEmptyError);
        expect(err.message).toContain('expiró');
    });
});

describe('commitFiles', () => {
    const FILES = [
        { path: 'course.yaml', content: 'title: X' },
        { path: 'README.md', content: '# X' },
    ];

    function mockGit({ refExists }: { refExists: boolean }) {
        const calls: { method: string; url: string; body: Record<string, unknown> | null }[] = [];
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
            async (url: string | URL, init?: RequestInit) => {
                const href = String(url);
                const method = init?.method ?? 'GET';
                const body = init?.body ? JSON.parse(init.body as string) : null;
                calls.push({ method, url: href, body });

                if (href.includes('/git/ref/heads/')) {
                    return refExists
                        ? jsonResponse({ object: { sha: 'HEADSHA' } })
                        : ({ ok: false, status: 409, json: async () => ({}) } as Response);
                }
                if (href.includes('/contents/')) return jsonResponse({ content: { sha: 'BOOTSTRAP' } });
                if (href.includes('/git/commits/HEADSHA')) return jsonResponse({ sha: 'HEADSHA', tree: { sha: 'BASETREE' } });
                if (href.includes('/git/blobs')) return jsonResponse({ sha: `blob${calls.length}` });
                if (href.includes('/git/trees')) return jsonResponse({ sha: 'NEWTREE' });
                if (href.includes('/git/commits')) return jsonResponse({ sha: 'NEWCOMMIT' });
                return jsonResponse({});
            }
        );
        return calls;
    }

    it('bootstraps an empty repo via the Contents API before using Git Data', async () => {
        // Verified against the live API: /git/blobs and /git/trees both answer
        // 409 "Git Repository is empty." until a first commit exists, so the
        // Contents API is the only way in.
        const calls = mockGit({ refExists: false });

        await commitFiles('o', 'r', 'main', FILES, 'msg', 'pat');

        const bootstrap = calls.find((c) => c.url.includes('/contents/'))!;
        expect(bootstrap.method).toBe('PUT');
        expect(bootstrap.url).toContain(FILES[0].path);
        expect(bootstrap.body!.branch).toBe('main');
        // A real template file, not a placeholder, so a partial failure still
        // leaves something legitimate behind.
        expect(Buffer.from(bootstrap.body!.content as string, 'base64').toString('utf8')).toBe(FILES[0].content);
        // ...and it happens before any Git Data call.
        expect(calls.indexOf(bootstrap)).toBeLessThan(calls.findIndex((c) => c.url.endsWith('/git/blobs')));
    });

    it('replaces the bootstrap so an empty repo ends with exactly one commit', async () => {
        const calls = mockGit({ refExists: false });

        const result = await commitFiles('o', 'r', 'main', FILES, 'msg', 'pat');

        expect(result.commitSha).toBe('NEWCOMMIT');
        const tree = calls.find((c) => c.url.endsWith('/git/trees'))!;
        expect(tree.body).not.toHaveProperty('base_tree');
        const commit = calls.find((c) => c.url.endsWith('/git/commits'))!;
        // Parentless: the bootstrap commit is discarded, not built upon.
        expect(commit.body!.parents).toEqual([]);
        const patch = calls.find((c) => c.method === 'PATCH')!;
        expect(patch.url).toContain('/git/refs/heads/main');
        expect(patch.body!.force).toBe(true);
    });

    it('stacks on the current head and patches the ref when the branch exists', async () => {
        const calls = mockGit({ refExists: true });

        await commitFiles('o', 'r', 'main', FILES, 'msg', 'pat');

        const tree = calls.find((c) => c.url.endsWith('/git/trees'))!;
        expect(tree.body!.base_tree).toBe('BASETREE');
        const commit = calls.find((c) => c.url.endsWith('/git/commits'))!;
        expect(commit.body!.parents).toEqual(['HEADSHA']);
        const patch = calls.find((c) => c.method === 'PATCH')!;
        expect(patch.url).toContain('/git/refs/heads/main');
        expect(patch.body!.sha).toBe('NEWCOMMIT');
        // Never force over history we did not create.
        expect(patch.body!.force).toBeUndefined();
        expect(calls.some((c) => c.url.includes('/contents/'))).toBe(false);
    });

    it('uploads one base64 blob per file', async () => {
        const calls = mockGit({ refExists: false });

        await commitFiles('o', 'r', 'main', FILES, 'msg', 'pat');

        const blobs = calls.filter((c) => c.url.endsWith('/git/blobs'));
        expect(blobs).toHaveLength(2);
        expect(Buffer.from(blobs[0].body!.content as string, 'base64').toString('utf8')).toBe('title: X');
    });

    it('encodes bootstrap file paths and rejects path traversal', async () => {
        const calls = mockGit({ refExists: false });

        await commitFiles('o', 'r', 'main', [{ path: 'módulo 1/course.yaml', content: 'title: X' }], 'msg', 'pat');

        const bootstrap = calls.find((c) => c.url.includes('/contents/'))!;
        expect(bootstrap.url).toContain('/contents/m%C3%B3dulo%201/course.yaml');

        await expect(commitFiles('o', 'r', 'main', [{ path: '../course.yaml', content: 'x' }], 'msg', 'pat')).rejects.toThrow(
            'Ruta de archivo inválida'
        );
    });

    it('explains a 403 as a missing write permission, not a bad token', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string | URL) => {
            const href = String(url);
            if (href.includes('/git/ref/heads/')) return { ok: false, status: 409, json: async () => ({}) } as Response;
            return { ok: false, status: 403, json: async () => ({}) } as Response;
        });

        const err = await commitFiles('o', 'r', 'main', FILES, 'msg', 'pat').catch((e) => e);

        expect(err.message).toContain('Read and Write access to code');
        expect(err.message).not.toMatch(/ghp_|github_pat_|Bearer/);
    });
});
