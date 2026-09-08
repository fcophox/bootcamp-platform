/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

function newTestContext() {
    return convexTest(schema, import.meta.glob('./**/*.*s'));
}

describe('genericQuery: table name translation (TABLE_MAP)', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('translates a PascalCase Supabase-style table name to the real Convex table', async () => {
        await t.mutation(api.db.genericInsert, {
            table: 'Bootcamp',
            document: { title: 'Mapped via Bootcamp' },
        });

        const viaAlias = await t.query(api.db.genericQuery, { table: 'Bootcamp' });
        const viaRealName = await t.query(api.db.genericQuery, { table: 'bootcamps' });

        expect(viaAlias).toHaveLength(1);
        expect(viaRealName).toHaveLength(1);
        expect(viaAlias[0].title).toBe('Mapped via Bootcamp');
    });

    it('translates UserRole to the legacyAuth table', async () => {
        await t.mutation(api.db.genericInsert, {
            table: 'UserRole',
            document: { email: 'a@example.com', passwordHash: 'hash', role: 'alumno', migrated: false },
        });

        const results = await t.query(api.db.genericQuery, { table: 'UserRole' });
        expect(results).toHaveLength(1);
        expect(results[0].email).toBe('a@example.com');
    });

    it('passes through an unmapped table name unchanged', async () => {
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Direct' } });
        const results = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(results).toHaveLength(1);
    });
});

describe('genericQuery: filtering and result shape', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('maps _id/_creationTime to id/createdAt in results', async () => {
        const { id } = await t.mutation(api.db.genericInsert, {
            table: 'bootcamps',
            document: { title: 'Shape test' },
        });

        const [result] = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(result.id).toBe(id);
        expect(result._id).toBe(id);
        expect(typeof result.createdAt).toBe('number');
    });

    it('filters by a plain field with eqFilters', async () => {
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'A' } });
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'B' } });

        const results = await t.query(api.db.genericQuery, {
            table: 'bootcamps',
            eqFilters: [{ field: 'title', value: 'B' }],
        });

        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('B');
    });

    it('filters by "id" against the mapped Convex _id', async () => {
        const { id } = await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Find me' } });
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Not me' } });

        const results = await t.query(api.db.genericQuery, {
            table: 'bootcamps',
            eqFilters: [{ field: 'id', value: id }],
        });

        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Find me');
    });

    it('legacyAuth id filter also matches on supabaseUserId and email (compatibility shim)', async () => {
        await t.mutation(api.db.genericInsert, {
            table: 'legacyAuth',
            document: {
                supabaseUserId: 'legacy-uuid-123',
                email: 'legacy@example.com',
                passwordHash: 'hash',
                role: 'docente',
                migrated: false,
            },
        });

        const bySupabaseId = await t.query(api.db.genericQuery, {
            table: 'legacyAuth',
            eqFilters: [{ field: 'id', value: 'legacy-uuid-123' }],
        });
        const byEmailAsId = await t.query(api.db.genericQuery, {
            table: 'legacyAuth',
            eqFilters: [{ field: 'id', value: 'legacy@example.com' }],
        });

        expect(bySupabaseId).toHaveLength(1);
        expect(byEmailAsId).toHaveLength(1);
    });

    it('bootcampId filter matches either bootcampId or the legacy fallback field', async () => {
        // legacyBootcampId only exists on tables (modules, bootcampStudents) where
        // bootcampId is a required v.id("bootcamps") reference, so both fields are
        // always present together in practice — the legacy field is an alternate
        // match, not a replacement for a missing bootcampId.
        const { id: bootcampId } = await t.mutation(api.db.genericInsert, {
            table: 'bootcamps',
            document: { title: 'Parent bootcamp' },
        });

        await t.mutation(api.db.genericInsert, {
            table: 'modules',
            document: { title: 'Module 1', order: 1, bootcampId, legacyBootcampId: 999 },
        });

        const byRealId = await t.query(api.db.genericQuery, {
            table: 'modules',
            eqFilters: [{ field: 'bootcampId', value: bootcampId }],
        });
        const byLegacyId = await t.query(api.db.genericQuery, {
            table: 'modules',
            eqFilters: [{ field: 'bootcampId', value: '999' }],
        });

        expect(byRealId).toHaveLength(1);
        expect(byLegacyId).toHaveLength(1);
        expect(byLegacyId[0].title).toBe('Module 1');
    });

    it('lessonCompletions output prefers legacyStudentId/legacyLessonId when present', async () => {
        await t.mutation(api.db.genericInsert, {
            table: 'lessonCompletions',
            document: { studentId: 'new-student', lessonId: 'new-lesson', legacyStudentId: 42, legacyLessonId: 7 },
        });

        const [result] = await t.query(api.db.genericQuery, { table: 'lessonCompletions' });
        expect(result.studentId).toBe(42);
        expect(result.lessonId).toBe(7);
    });

    it('orders results ascending and descending, with undefined values last', async () => {
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'B', students: 2 } });
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'A', students: 1 } });
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'C' } }); // students undefined

        const asc = await t.query(api.db.genericQuery, {
            table: 'bootcamps',
            orderField: 'students',
        });
        expect(asc.map((r: { title: string }) => r.title)).toEqual(['A', 'B', 'C']);

        const desc = await t.query(api.db.genericQuery, {
            table: 'bootcamps',
            orderField: 'students',
            orderDesc: true,
        });
        expect(desc.map((r: { title: string }) => r.title)).toEqual(['C', 'B', 'A']);
    });

    it('filters by inFilters on a plain field', async () => {
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'A' } });
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'B' } });
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'C' } });

        const results = await t.query(api.db.genericQuery, {
            table: 'bootcamps',
            inFilters: [{ field: 'title', values: ['A', 'C'] }],
        });

        expect(results.map((r: { title: string }) => r.title).sort()).toEqual(['A', 'C']);
    });
});

describe('genericInsert', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('strips an incoming "id" field before inserting', async () => {
        const { id } = await t.mutation(api.db.genericInsert, {
            table: 'bootcamps',
            document: { id: 'should-be-stripped', title: 'Stripped' },
        });

        const [result] = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(result.id).toBe(id);
        expect(result.id).not.toBe('should-be-stripped');
    });

    it('strips null-valued fields (Convex optional() rejects null, not undefined)', async () => {
        const { id } = await t.mutation(api.db.genericInsert, {
            table: 'bootcamps',
            document: { title: 'No nulls', description: null, color: null },
        });

        const [result] = await t.query(api.db.genericQuery, {
            table: 'bootcamps',
            eqFilters: [{ field: 'id', value: id }],
        });
        expect(result.description).toBeUndefined();
        expect(result.color).toBeUndefined();
    });
});

describe('genericUpdate', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('updates by a real Convex id', async () => {
        const { id } = await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Before' } });

        await t.mutation(api.db.genericUpdate, { table: 'bootcamps', id, document: { title: 'After' } });

        const [result] = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(result.title).toBe('After');
    });

    it('falls back to legacyId when the id is not a valid Convex id', async () => {
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Before', legacyId: 123 } });

        await t.mutation(api.db.genericUpdate, { table: 'bootcamps', id: '123', document: { title: 'After' } });

        const [result] = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(result.title).toBe('After');
    });

    it('throws when no document matches the given id', async () => {
        await expect(
            t.mutation(api.db.genericUpdate, { table: 'bootcamps', id: '999999', document: { title: 'X' } })
        ).rejects.toThrow(/Could not find document/);
    });
});

describe('genericDelete', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('deletes by a real Convex id', async () => {
        const { id } = await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Gone' } });

        await t.mutation(api.db.genericDelete, { table: 'bootcamps', id });

        const results = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(results).toHaveLength(0);
    });

    it('falls back to legacyId when the id is not a valid Convex id', async () => {
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Gone', legacyId: 55 } });

        await t.mutation(api.db.genericDelete, { table: 'bootcamps', id: '55' });

        const results = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(results).toHaveLength(0);
    });

    it('silently no-ops when no document matches (does not throw, unlike genericUpdate)', async () => {
        await t.mutation(api.db.genericInsert, { table: 'bootcamps', document: { title: 'Untouched' } });

        await expect(
            t.mutation(api.db.genericDelete, { table: 'bootcamps', id: '999999' })
        ).resolves.toEqual({ success: true });

        const results = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(results).toHaveLength(1);
    });
});

describe('genericUpsert', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('inserts when no record matches the default uniqueKeys for lessonFeedbacks', async () => {
        const result = await t.mutation(api.db.genericUpsert, {
            table: 'lessonFeedbacks',
            document: { userId: 'u1', lessonId: 'l1', isLiked: true },
        });

        expect(result.inserted).toBe(true);
        const results = await t.query(api.db.genericQuery, { table: 'lessonFeedbacks' });
        expect(results).toHaveLength(1);
    });

    it('updates the existing record when the default uniqueKeys match (lessonFeedbacks: userId+lessonId)', async () => {
        await t.mutation(api.db.genericUpsert, {
            table: 'lessonFeedbacks',
            document: { userId: 'u1', lessonId: 'l1', isLiked: true },
        });

        const second = await t.mutation(api.db.genericUpsert, {
            table: 'lessonFeedbacks',
            document: { userId: 'u1', lessonId: 'l1', isLiked: false, comment: 'changed my mind' },
        });

        expect(second.updated).toBe(true);
        const results = await t.query(api.db.genericQuery, { table: 'lessonFeedbacks' });
        expect(results).toHaveLength(1);
        expect(results[0].isLiked).toBe(false);
        expect(results[0].comment).toBe('changed my mind');
    });

    it('respects explicit uniqueKeys over the per-table defaults', async () => {
        await t.mutation(api.db.genericUpsert, {
            table: 'bootcamps',
            document: { title: 'Alpha', slug: 'alpha' },
            uniqueKeys: ['slug'],
        });

        const result = await t.mutation(api.db.genericUpsert, {
            table: 'bootcamps',
            document: { title: 'Alpha Renamed', slug: 'alpha' },
            uniqueKeys: ['slug'],
        });

        expect(result.updated).toBe(true);
        const results = await t.query(api.db.genericQuery, { table: 'bootcamps' });
        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Alpha Renamed');
    });
});
