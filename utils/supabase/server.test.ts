import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchQuery = vi.fn();
const fetchMutation = vi.fn();
const convexAuthNextjsToken = vi.fn();

vi.mock('convex/nextjs', () => ({
    fetchQuery: (...args: unknown[]) => fetchQuery(...args),
    fetchMutation: (...args: unknown[]) => fetchMutation(...args),
}));

vi.mock('@convex-dev/auth/nextjs/server', () => ({
    convexAuthNextjsToken: (...args: unknown[]) => convexAuthNextjsToken(...args),
}));

vi.mock('@/convex/_generated/api', () => ({
    api: {
        db: {
            genericQuery: 'db.genericQuery',
            genericInsert: 'db.genericInsert',
            genericUpdate: 'db.genericUpdate',
            genericDelete: 'db.genericDelete',
            genericUpsert: 'db.genericUpsert',
        },
        users: {
            getCurrentUserWithRole: 'users.getCurrentUserWithRole',
        },
    },
}));

const { createClient } = await import('./server');

beforeEach(() => {
    fetchQuery.mockReset();
    fetchMutation.mockReset();
    convexAuthNextjsToken.mockReset();
});

describe('createClient().auth', () => {
    it('getUser() returns null when there is no auth token', async () => {
        convexAuthNextjsToken.mockResolvedValue(undefined);

        const client = await createClient();
        const { data, error } = await client.auth.getUser();

        expect(data.user).toBeNull();
        expect(error).toBeNull();
        expect(fetchQuery).not.toHaveBeenCalled();
    });

    it('getUser() returns a Supabase-shaped user built from Convex user info when a token exists', async () => {
        convexAuthNextjsToken.mockResolvedValue('a-token');
        fetchQuery.mockResolvedValue({ email: 'alumno@example.com', name: 'Alumno Uno', role: 'alumno' });

        const client = await createClient();
        const { data } = await client.auth.getUser();

        expect(data.user).toMatchObject({
            id: 'alumno@example.com',
            email: 'alumno@example.com',
            user_metadata: { full_name: 'Alumno Uno', role: 'alumno' },
        });
        expect(fetchQuery).toHaveBeenCalledWith('users.getCurrentUserWithRole', {}, { token: 'a-token' });
    });

    it('getUser() falls back to null when fetching Convex user info throws', async () => {
        convexAuthNextjsToken.mockResolvedValue('a-token');
        fetchQuery.mockRejectedValue(new Error('network error'));

        const client = await createClient();
        const { data, error } = await client.auth.getUser();

        expect(data.user).toBeNull();
        expect(error).toBeNull(); // errors are swallowed, not surfaced, by design
    });

    it('getSession() mirrors getUser(): a session only when a user was resolved', async () => {
        convexAuthNextjsToken.mockResolvedValue('a-token');
        fetchQuery.mockResolvedValue({ email: 'docente@example.com', role: 'docente' });

        const client = await createClient();
        const { data } = await client.auth.getSession();

        expect(data.session?.user.email).toBe('docente@example.com');
    });

    it('stub auth methods (updateUser/signIn/signUp/admin) resolve without throwing', async () => {
        convexAuthNextjsToken.mockResolvedValue(undefined);
        const client = await createClient();

        await expect(client.auth.updateUser()).resolves.toMatchObject({ error: null });
        await expect(client.auth.signInWithPassword()).resolves.toMatchObject({ error: null });
        await expect(client.auth.signUp()).resolves.toMatchObject({ error: null });
        await expect(client.auth.admin.listUsers()).resolves.toMatchObject({ data: { users: [] } });
        await expect(client.auth.admin.deleteUser()).resolves.toMatchObject({ error: null });
    });
});

describe('createClient().from(table): query building', () => {
    beforeEach(() => {
        convexAuthNextjsToken.mockResolvedValue('a-token');
    });

    it('.select() with no filters queries with empty filter arrays', async () => {
        fetchQuery.mockResolvedValue([{ id: '1' }]);
        const client = await createClient();

        const { data, error } = await client.from('bootcamps').select();

        expect(error).toBeNull();
        expect(data).toEqual([{ id: '1' }]);
        expect(fetchQuery).toHaveBeenCalledWith(
            'db.genericQuery',
            { table: 'bootcamps', eqFilters: [], inFilters: [], orderField: undefined, orderDesc: undefined },
            { token: 'a-token' }
        );
    });

    it('chained .eq() calls accumulate eqFilters in order', async () => {
        fetchQuery.mockResolvedValue([]);
        const client = await createClient();

        await client.from('bootcampStudents').select().eq('bootcampId', 'b1').eq('status', 'active');

        expect(fetchQuery).toHaveBeenCalledWith(
            'db.genericQuery',
            expect.objectContaining({
                eqFilters: [
                    { field: 'bootcampId', value: 'b1' },
                    { field: 'status', value: 'active' },
                ],
            }),
            expect.anything()
        );
    });

    it('.ilike() is treated identically to .eq() (no real pattern matching)', async () => {
        fetchQuery.mockResolvedValue([]);
        const client = await createClient();

        await client.from('bootcamps').select().ilike('title', '%intro%');

        expect(fetchQuery).toHaveBeenCalledWith(
            'db.genericQuery',
            expect.objectContaining({ eqFilters: [{ field: 'title', value: '%intro%' }] }),
            expect.anything()
        );
    });

    it('.in() sets inFilters', async () => {
        fetchQuery.mockResolvedValue([]);
        const client = await createClient();

        await client.from('bootcamps').select().in('id', ['a', 'b']);

        expect(fetchQuery).toHaveBeenCalledWith(
            'db.genericQuery',
            expect.objectContaining({ inFilters: [{ field: 'id', values: ['a', 'b'] }] }),
            expect.anything()
        );
    });

    it('.order() defaults to ascending, and ascending:false sets orderDesc', async () => {
        fetchQuery.mockResolvedValue([]);
        const client = await createClient();

        await client.from('bootcamps').select().order('createdAt');
        expect(fetchQuery).toHaveBeenLastCalledWith(
            'db.genericQuery',
            expect.objectContaining({ orderField: 'createdAt', orderDesc: false }),
            expect.anything()
        );

        await client.from('bootcamps').select().order('createdAt', { ascending: false });
        expect(fetchQuery).toHaveBeenLastCalledWith(
            'db.genericQuery',
            expect.objectContaining({ orderField: 'createdAt', orderDesc: true }),
            expect.anything()
        );
    });

    it('.single() returns the first row, or null when there are no results', async () => {
        fetchQuery.mockResolvedValue([{ id: '1' }, { id: '2' }]);
        const client = await createClient();
        const { data } = await client.from('bootcamps').select().single();
        expect(data).toEqual({ id: '1' });

        fetchQuery.mockResolvedValue([]);
        const empty = await client.from('bootcamps').select().single();
        expect(empty.data).toBeNull();
    });

    it('.maybeSingle() behaves the same as .single()', async () => {
        fetchQuery.mockResolvedValue([]);
        const client = await createClient();
        const { data } = await client.from('bootcamps').select().maybeSingle();
        expect(data).toBeNull();
    });

    it('surfaces a query error instead of throwing, with an empty data array', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchQuery.mockRejectedValue(new Error('convex is down'));
        const client = await createClient();

        const { data, error } = await client.from('bootcamps').select();

        expect(data).toEqual([]);
        expect(error).toBeInstanceOf(Error);
        consoleError.mockRestore();
    });
});

describe('createClient().from(table): mutations', () => {
    beforeEach(() => {
        convexAuthNextjsToken.mockResolvedValue('a-token');
    });

    it('.insert(document) calls genericInsert with the document as-is', async () => {
        fetchMutation.mockResolvedValue({ id: 'new-id' });
        const client = await createClient();

        const { data } = await client.from('bootcamps').insert({ title: 'New' });

        expect(data).toEqual({ id: 'new-id' });
        expect(fetchMutation).toHaveBeenCalledWith(
            'db.genericInsert',
            { table: 'bootcamps', document: { title: 'New' } },
            { token: 'a-token' }
        );
    });

    it('.insert([document]) (array form) inserts only the first element', async () => {
        fetchMutation.mockResolvedValue({ id: 'new-id' });
        const client = await createClient();

        await client.from('bootcamps').insert([{ title: 'First' }, { title: 'Second' }]);

        expect(fetchMutation).toHaveBeenCalledWith(
            'db.genericInsert',
            { table: 'bootcamps', document: { title: 'First' } },
            expect.anything()
        );
    });

    it('.update(document).eq("id", x) calls genericUpdate with the matched id', async () => {
        fetchMutation.mockResolvedValue(null);
        const client = await createClient();

        await client.from('bootcamps').update({ title: 'Renamed' }).eq('id', 'b1');

        expect(fetchMutation).toHaveBeenCalledWith(
            'db.genericUpdate',
            { table: 'bootcamps', id: 'b1', ids: undefined, document: { title: 'Renamed' } },
            { token: 'a-token' }
        );
    });

    it('.update(document) without a matching .eq("id", ...) never calls the mutation (silent no-op)', async () => {
        const client = await createClient();

        const { data, error } = await client.from('bootcamps').update({ title: 'Renamed' });

        expect(fetchMutation).not.toHaveBeenCalled();
        expect(data).toBeNull();
        expect(error).toBeNull();
    });

    it('.delete().eq("id", x) calls genericDelete with the matched id', async () => {
        fetchMutation.mockResolvedValue({ success: true });
        const client = await createClient();

        await client.from('bootcamps').delete().eq('id', 'b1');

        expect(fetchMutation).toHaveBeenCalledWith(
            'db.genericDelete',
            { table: 'bootcamps', id: 'b1', ids: undefined },
            { token: 'a-token' }
        );
    });

    it('.upsert(document, {onConflict}) translates onConflict into uniqueKeys', async () => {
        fetchMutation.mockResolvedValue({ id: 'x', updated: true });
        const client = await createClient();

        await client.from('lessonFeedbacks').upsert({ userId: 'u1', lessonId: 'l1' }, { onConflict: 'userId,lessonId' });

        expect(fetchMutation).toHaveBeenCalledWith(
            'db.genericUpsert',
            { table: 'lessonFeedbacks', document: { userId: 'u1', lessonId: 'l1' }, uniqueKeys: ['userId', 'lessonId'] },
            { token: 'a-token' }
        );
    });
});
