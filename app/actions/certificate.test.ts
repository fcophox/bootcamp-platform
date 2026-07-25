import { describe, it, expect, vi, beforeEach } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const fetchQuery = vi.fn();
vi.mock('convex/nextjs', () => ({ fetchQuery: (...args: unknown[]) => fetchQuery(...args) }));

const convexAuthNextjsToken = vi.fn();
vi.mock('@convex-dev/auth/nextjs/server', () => ({
    convexAuthNextjsToken: (...args: unknown[]) => convexAuthNextjsToken(...args),
}));

vi.mock('@/convex/_generated/api', () => ({
    api: { users: { getCurrentUserWithRole: 'users.getCurrentUserWithRole' } },
}));

// Minimal thenable chain mirroring the real shim's fluent API.
interface FakeChain {
    select: () => FakeChain;
    eq: () => FakeChain;
    neq: () => FakeChain;
    in: () => FakeChain;
    order: () => FakeChain;
    single: () => Promise<{ data: unknown; error: unknown }>;
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => unknown;
}

function fakeResult(data: unknown, error: unknown = null): FakeChain {
    const chain: FakeChain = {
        select: () => chain,
        eq: () => chain,
        neq: () => chain,
        in: () => chain,
        order: () => chain,
        single: () => Promise.resolve({ data, error }),
        then: (resolve) => resolve({ data, error }),
    };
    return chain;
}

const mockFrom = vi.fn();
vi.mock('@/utils/supabase/server', () => ({
    createClient: async () => ({ from: mockFrom }),
}));

const { createCertificate, updateCertificate, deleteCertificate, getCertificateByBootcamp } = await import(
    './certificate'
);

beforeEach(() => {
    revalidatePath.mockReset();
    fetchQuery.mockReset();
    convexAuthNextjsToken.mockReset();
    mockFrom.mockReset();
});

function mockUser(role: string | null) {
    if (role === null) {
        convexAuthNextjsToken.mockResolvedValue(undefined);
    } else {
        convexAuthNextjsToken.mockResolvedValue('a-token');
        fetchQuery.mockResolvedValue({ role });
    }
}

describe('authorization gates (createCertificate/updateCertificate/deleteCertificate)', () => {
    it('createCertificate rejects when there is no authenticated user', async () => {
        mockUser(null);
        const result = await createCertificate({ bootcampId: 1, title: 'Cert' });
        expect(result).toEqual({ error: 'No autorizado' });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it('createCertificate rejects a non-superadmin role', async () => {
        mockUser('docente');
        const result = await createCertificate({ bootcampId: 1, title: 'Cert' });
        expect(result.error).toMatch(/no tienes permisos/i);
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it('createCertificate allows superadmin and applies field defaults', async () => {
        mockUser('superadmin');
        const insertSpy = vi.fn(() => fakeResult({ id: 'c1' }));
        mockFrom.mockReturnValue({ insert: insertSpy });

        const result = await createCertificate({ bootcampId: 1, title: 'Cert' });

        expect(result.success).toBe(true);
        expect(insertSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                textColor: '#000000',
                titleFontSize: 24,
                nameFontSize: 32,
                showInstructorSignature: true,
                showDirectorSignature: true,
                isActive: false,
                backgroundImageUrl: null,
            })
        );
        expect(revalidatePath).toHaveBeenCalledWith('/cms/certificados');
    });

    it('updateCertificate rejects when there is no authenticated user', async () => {
        mockUser(null);
        const result = await updateCertificate(1, { title: 'X' });
        expect(result).toEqual({ error: 'No autorizado' });
    });

    it('updateCertificate rejects a non-superadmin role', async () => {
        mockUser('alumno');
        const result = await updateCertificate(1, { title: 'X' });
        expect(result.error).toMatch(/no tienes permisos/i);
    });

    it('deleteCertificate rejects a non-superadmin role', async () => {
        mockUser('docente');
        const result = await deleteCertificate(1);
        expect(result.error).toMatch(/no tienes permisos/i);
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it('deleteCertificate succeeds for superadmin', async () => {
        mockUser('superadmin');
        mockFrom.mockReturnValue({ delete: () => fakeResult(null) });

        const result = await deleteCertificate(1);

        expect(result).toEqual({ success: true });
        expect(revalidatePath).toHaveBeenCalledWith('/cms/certificados');
    });
});

describe('updateCertificate: single-active-certificate-per-bootcamp invariant', () => {
    beforeEach(() => mockUser('superadmin'));

    it('deactivates sibling certificates for the same bootcamp when activating this one', async () => {
        const updateSpy = vi.fn(() => ({ ...fakeResult(null), neq: () => fakeResult(null) }));
        mockFrom.mockImplementation((table: string) => {
            expect(table).toBe('Certificate');
            return {
                select: () => fakeResult({ bootcampId: 'b1' }), // existing cert lookup
                update: updateSpy,
            };
        });

        await updateCertificate('c1', { isActive: true });

        // First call: deactivate siblings ({ isActive: false }); second: the actual update.
        expect(updateSpy).toHaveBeenCalledWith({ isActive: false });
        expect(updateSpy).toHaveBeenCalledWith({ isActive: true });
        expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it('does not touch sibling certificates when not activating', async () => {
        const updateSpy = vi.fn(() => fakeResult(null));
        const selectSpy = vi.fn();
        mockFrom.mockReturnValue({ select: selectSpy, update: updateSpy });

        await updateCertificate('c1', { title: 'Renamed only' });

        expect(selectSpy).not.toHaveBeenCalled();
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledWith({ title: 'Renamed only' });
    });
});

describe('getCertificateByBootcamp', () => {
    it('returns the active certificate when one exists', async () => {
        mockFrom.mockReturnValue(fakeResult({ id: 'c1', isActive: true }));
        const result = await getCertificateByBootcamp('b1');
        expect(result).toEqual({ id: 'c1', isActive: true });
    });

    it('returns null (not an error) when no active certificate exists', async () => {
        // The Convex-backed shim's .single() resolves { data: null, error: null } on an
        // empty result set (unlike Supabase/PostgREST, which used to return an
        // error with code PGRST116 here) -- documenting actual current behavior.
        mockFrom.mockReturnValue(fakeResult(null, null));
        const result = await getCertificateByBootcamp('b1');
        expect(result).toBeNull();
    });

    it('returns null and logs when a real query error occurs', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockFrom.mockReturnValue(fakeResult(null, new Error('convex down')));

        const result = await getCertificateByBootcamp('b1');

        expect(result).toBeNull();
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
