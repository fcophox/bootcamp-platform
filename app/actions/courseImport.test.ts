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
vi.mock('@/lib/courseImport/github', () => ({
    fetchRepoFiles: (...args: unknown[]) => fetchRepoFiles(...args),
    parseRepoUrl: (...args: unknown[]) => parseRepoUrl(...args),
}));

const COURSE = {
    title: 'T', description: 'D', duration: '1', level: 'Intermedio', startDate: '2026-01-01',
    icon: 'code', color: 'green', enableChecklist: true, enableRanking: true,
    modules: [{ sourcePath: 'modules/01-a', title: 'A', order: 1, lessons: [] }],
};

const { planImportFromRepo, applyImportPlan, planResync, reconnectRepo } = await import('./courseImport');

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
