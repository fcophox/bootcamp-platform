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
            updatePatConnection: 'courseImport.updatePatConnection',
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
const commitFiles = vi.fn();

vi.mock('@/lib/courseImport/github', async (importOriginal) => {
    // Partial mock: CourseImportEmptyError is a real class the action does an
    // `instanceof` check against, so it must be the genuine one.
    const actual = await importOriginal<typeof import('@/lib/courseImport/github')>();
    return {
        ...actual,
        fetchRepoFiles: (...args: unknown[]) => fetchRepoFiles(...args),
        parseRepoUrl: (...args: unknown[]) => parseRepoUrl(...args),
        commitFiles: (...args: unknown[]) => commitFiles(...args),
    };
});

const COURSE = {
    title: 'T', description: 'D', duration: '1', level: 'Intermedio', startDate: '2026-01-01',
    icon: 'code', color: 'green', enableChecklist: true, enableRanking: true,
    modules: [{ sourcePath: 'modules/01-a', title: 'A', order: 1, lessons: [] }],
};

const { planImportFromRepo, applyImportPlan, planResync, reconnectRepo, createTemplateInRepo } = await import('./courseImport');
const { CourseImportEmptyError } = await import('@/lib/courseImport/github');

beforeEach(() => {
    fetchQuery.mockReset();
    fetchMutation.mockReset();
    convexAuthNextjsToken.mockReset();
    revalidatePath.mockReset();
    fetchRepoFiles.mockReset();
    parseRepoUrl.mockReset();
    commitFiles.mockReset();
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
        expect(callArgs.connection.pat).toBeUndefined();
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

describe('reconnectRepo', () => {
    it('rejects a non-docente/superadmin caller without calling fetchMutation', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'alumno' });

        const result = await reconnectRepo({ bootcampId: 'bc1', pat: 'new-secret' });

        expect('error' in result && result.error).toContain('permisos');
        expect(fetchMutation).not.toHaveBeenCalled();
    });

    it('encrypts the PAT before sending it to Convex', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'docente' });
        fetchMutation.mockResolvedValue(undefined);

        const result = await reconnectRepo({ bootcampId: 'bc1', pat: 'new-secret' });

        expect(result).toEqual({ success: true });
        const callArgs = fetchMutation.mock.calls[0][1];
        expect(callArgs.sourcePatEncrypted).toBe('encrypted(new-secret)');
        expect(callArgs.pat).toBeUndefined();
    });

    it('revalidates the manage path on success', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'docente' });
        fetchMutation.mockResolvedValue(undefined);

        await reconnectRepo({ bootcampId: 'bc1', pat: 'new-secret' });

        expect(revalidatePath).toHaveBeenCalledWith('/cms/bootcamp/bc1/manage');
    });
});

describe('planImportFromRepo — empty source', () => {
    beforeEach(() => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'docente' });
        parseRepoUrl.mockReturnValue({ owner: 'o', repo: 'r' });
    });

    it('reports an empty repo with the template it would create', async () => {
        fetchRepoFiles.mockRejectedValue(new CourseImportEmptyError('repo', 'vacío'));

        const result = await planImportFromRepo({ repoUrl: 'o/r', path: '', ref: 'main', pat: 'x' });

        expect('empty' in result).toBe(true);
        if (!('empty' in result)) throw new Error('unreachable');
        expect(result.empty.kind).toBe('repo');
        expect(result.empty.templateFiles).toContain('course.yaml');
        expect(result.empty.commitMessage).toMatch(/^chore: /);
    });

    it('rebases the listed template files under the configured path', async () => {
        fetchRepoFiles.mockRejectedValue(new CourseImportEmptyError('path', 'sin archivos'));

        const result = await planImportFromRepo({ repoUrl: 'o/r', path: '/cursos/x/', ref: 'main', pat: 'x' });

        if (!('empty' in result)) throw new Error('expected empty result');
        expect(result.empty.kind).toBe('path');
        expect(result.empty.templateFiles).toContain('cursos/x/course.yaml');
        expect(result.empty.path).toBe('cursos/x');
    });

    it('returns a plain error (never an empty offer) for other failures', async () => {
        // Critical: a parse or auth failure must not offer to write the
        // template, or we would overwrite content that already exists.
        fetchRepoFiles.mockRejectedValue(new Error('token expiró'));

        const result = await planImportFromRepo({ repoUrl: 'o/r', path: '', ref: 'main', pat: 'x' });

        expect('empty' in result).toBe(false);
        expect('error' in result && result.error).toContain('expiró');
    });
});

describe('createTemplateInRepo', () => {
    it('rejects an alumno without touching the repository', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'alumno' });

        const result = await createTemplateInRepo({ repoUrl: 'o/r', path: '', ref: 'main', pat: 'x' });

        expect('error' in result && result.error).toContain('permisos');
        expect(commitFiles).not.toHaveBeenCalled();
    });

    it('commits the template at the configured path and branch', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'docente' });
        parseRepoUrl.mockReturnValue({ owner: 'o', repo: 'r' });
        commitFiles.mockResolvedValue({ commitSha: 'abc123' });

        const result = await createTemplateInRepo({ repoUrl: 'o/r', path: 'cursos/x', ref: 'dev', pat: 'secret' });

        expect(result).toEqual({ ok: true, commitSha: 'abc123' });
        const [owner, repo, ref, files, message] = commitFiles.mock.calls[0];
        expect([owner, repo, ref]).toEqual(['o', 'r', 'dev']);
        expect(message).toMatch(/^chore: /);
        expect(files.map((f: { path: string }) => f.path)).toContain('cursos/x/course.yaml');
    });

    it('surfaces a write failure instead of throwing', async () => {
        convexAuthNextjsToken.mockResolvedValue('token');
        fetchQuery.mockResolvedValue({ role: 'docente' });
        parseRepoUrl.mockReturnValue({ owner: 'o', repo: 'r' });
        commitFiles.mockRejectedValue(new Error('necesita el permiso "Read and Write access to code"'));

        const result = await createTemplateInRepo({ repoUrl: 'o/r', path: '', ref: 'main', pat: 'x' });

        expect('error' in result && result.error).toContain('Read and Write access to code');
    });
});
