// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

function newTestContext() {
    return convexTest(schema, import.meta.glob('./**/*.*s'));
}

const COURSE = {
    title: 'Bootcamp Test',
    description: 'D',
    duration: '4 semanas',
    level: 'Intermedio',
    startDate: '2026-01-01',
    icon: 'code',
    color: 'green',
    enableChecklist: true,
    enableRanking: true,
};

const CONNECTION = {
    sourceRepo: 'owner/repo',
    sourcePath: 'cursos/x',
    sourceRef: 'main',
    sourcePatEncrypted: 'iv.tag.ciphertext',
};

describe('applyImport', () => {
    let t: ReturnType<typeof newTestContext>;
    beforeEach(() => {
        t = newTestContext();
    });

    it('creates a new bootcamp with its modules and lessons', async () => {
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [{ sourcePath: 'modules/01-a', title: 'A', order: 1 }],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [
                {
                    moduleSourcePath: 'modules/01-a',
                    sourcePath: 'modules/01-a/01-l.md',
                    title: 'L',
                    type: 'text',
                    order: 1,
                    content: '{"html":"<p>x</p>","imageUrl":""}',
                    sourceHash: 'h1',
                },
            ],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        const bootcamp = await t.query(api.bootcamps.getById, { id: bootcampId });
        expect(bootcamp?.title).toBe('Bootcamp Test');
        expect(bootcamp?.sourceRepo).toBe('owner/repo');
        expect(bootcamp?.lastSyncStatus).toBe('success');

        const modules = await t.query(api.modules.listByBootcamp, { bootcampId });
        expect(modules).toHaveLength(1);
        expect(modules[0].sourcePath).toBe('modules/01-a');
    });

    it('throws when creating a bootcamp without connection info', async () => {
        await expect(
            t.mutation(api.courseImport.applyImport, {
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [],
                modulesToDelete: [],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToDelete: [],
            })
        ).rejects.toThrow('connection es requerido');
    });

    it('updates an existing bootcamp, module, and lesson on re-sync', async () => {
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [{ sourcePath: 'modules/01-a', title: 'A', order: 1 }],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [
                {
                    moduleSourcePath: 'modules/01-a',
                    sourcePath: 'modules/01-a/01-l.md',
                    title: 'L',
                    type: 'text',
                    order: 1,
                    content: '{"html":"<p>old</p>","imageUrl":""}',
                    sourceHash: 'h1',
                },
            ],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        const modules = await t.query(api.modules.listByBootcamp, { bootcampId });
        const lessons = await t.query(api.lessons.listByModule, { moduleId: modules[0]._id });

        await t.mutation(api.courseImport.applyImport, {
            bootcampId,
            course: { ...COURSE, title: 'Bootcamp Actualizado' },
            modulesToCreate: [],
            modulesToUpdate: [{ convexId: modules[0]._id, sourcePath: 'modules/01-a', title: 'A actualizado', order: 1 }],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [
                {
                    convexId: lessons[0]._id,
                    title: 'L actualizado',
                    type: 'text',
                    order: 1,
                    content: '{"html":"<p>new</p>","imageUrl":""}',
                    sourceHash: 'h2',
                },
            ],
            lessonsToDelete: [],
        });

        const bootcamp = await t.query(api.bootcamps.getById, { id: bootcampId });
        expect(bootcamp?.title).toBe('Bootcamp Actualizado');
        const updatedModules = await t.query(api.modules.listByBootcamp, { bootcampId });
        expect(updatedModules[0].title).toBe('A actualizado');
        const updatedLessons = await t.query(api.lessons.listByModule, { moduleId: modules[0]._id });
        expect(updatedLessons[0].title).toBe('L actualizado');
        expect(updatedLessons[0].sourceHash).toBe('h2');
    });

    it('deletes lessons before modules without throwing when a whole module is removed', async () => {
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [{ sourcePath: 'modules/01-a', title: 'A', order: 1 }],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [
                {
                    moduleSourcePath: 'modules/01-a',
                    sourcePath: 'modules/01-a/01-l.md',
                    title: 'L',
                    type: 'text',
                    order: 1,
                    content: '{}',
                    sourceHash: 'h1',
                },
            ],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        const modules = await t.query(api.modules.listByBootcamp, { bootcampId });
        const lessons = await t.query(api.lessons.listByModule, { moduleId: modules[0]._id });

        await expect(
            t.mutation(api.courseImport.applyImport, {
                bootcampId,
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [],
                modulesToDelete: [modules[0]._id],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToDelete: [lessons[0]._id],
            })
        ).resolves.not.toThrow();

        const remainingModules = await t.query(api.modules.listByBootcamp, { bootcampId });
        expect(remainingModules).toHaveLength(0);
    });

    it('rejects a plan that references another bootcamp\'s module/lesson IDs', async () => {
        // Bootcamp A: has a module and lesson we'll try to smuggle into B's plan.
        const { bootcampId: bootcampIdA } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [{ sourcePath: 'modules/01-a', title: 'A', order: 1 }],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [
                {
                    moduleSourcePath: 'modules/01-a',
                    sourcePath: 'modules/01-a/01-l.md',
                    title: 'L',
                    type: 'text',
                    order: 1,
                    content: '{}',
                    sourceHash: 'h1',
                },
            ],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });
        const modulesA = await t.query(api.modules.listByBootcamp, { bootcampId: bootcampIdA });
        const lessonsA = await t.query(api.lessons.listByModule, { moduleId: modulesA[0]._id });

        // Bootcamp B: an unrelated bootcamp.
        const { bootcampId: bootcampIdB } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        // Try to patch bootcamp A's module via a plan targeting bootcamp B.
        await expect(
            t.mutation(api.courseImport.applyImport, {
                bootcampId: bootcampIdB,
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [
                    { convexId: modulesA[0]._id, sourcePath: 'modules/01-a', title: 'Hijacked', order: 1 },
                ],
                modulesToDelete: [],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToDelete: [],
            })
        ).rejects.toThrow('no pertenece a este bootcamp');

        // Try to delete bootcamp A's module via a plan targeting bootcamp B.
        await expect(
            t.mutation(api.courseImport.applyImport, {
                bootcampId: bootcampIdB,
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [],
                modulesToDelete: [modulesA[0]._id],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToDelete: [],
            })
        ).rejects.toThrow('no pertenece a este bootcamp');

        // Try to patch bootcamp A's lesson via a plan targeting bootcamp B.
        await expect(
            t.mutation(api.courseImport.applyImport, {
                bootcampId: bootcampIdB,
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [],
                modulesToDelete: [],
                lessonsToCreate: [],
                lessonsToUpdate: [
                    {
                        convexId: lessonsA[0]._id,
                        title: 'Hijacked',
                        type: 'text',
                        order: 1,
                        content: '{}',
                        sourceHash: 'h2',
                    },
                ],
                lessonsToDelete: [],
            })
        ).rejects.toThrow('no pertenece a este bootcamp');

        // Try to delete bootcamp A's lesson via a plan targeting bootcamp B.
        await expect(
            t.mutation(api.courseImport.applyImport, {
                bootcampId: bootcampIdB,
                course: COURSE,
                modulesToCreate: [],
                modulesToUpdate: [],
                modulesToDelete: [],
                lessonsToCreate: [],
                lessonsToUpdate: [],
                lessonsToDelete: [lessonsA[0]._id],
            })
        ).rejects.toThrow('no pertenece a este bootcamp');

        // Bootcamp A's data must be untouched by all of the rejected attempts.
        const modulesAAfter = await t.query(api.modules.listByBootcamp, { bootcampId: bootcampIdA });
        expect(modulesAAfter[0].title).toBe('A');
        const lessonsAAfter = await t.query(api.lessons.listByModule, { moduleId: modulesA[0]._id });
        expect(lessonsAAfter[0].title).toBe('L');
    });
});

describe('updatePatConnection', () => {
    it('updates the stored PAT and clears stale failure status', async () => {
        const t = newTestContext();
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        await t.mutation(api.courseImport.recordSyncFailure, {
            bootcampId,
            error: 'GitHub respondió 401',
        });

        await t.mutation(api.courseImport.updatePatConnection, {
            bootcampId,
            sourcePatEncrypted: 'new.iv.tag.ciphertext',
        });

        const bootcamp = await t.query(api.bootcamps.getById, { id: bootcampId });
        expect(bootcamp?.sourcePatEncrypted).toBe('new.iv.tag.ciphertext');
        expect(bootcamp?.lastSyncStatus).toBeUndefined();
        expect(bootcamp?.lastSyncError).toBeUndefined();
    });

    it('throws when the bootcamp is not connected to a repository', async () => {
        const t = newTestContext();
        const bootcampId = await t.mutation(api.bootcamps.create, {
            title: 'Manual Bootcamp',
            slug: 'manual-bootcamp',
        });

        await expect(
            t.mutation(api.courseImport.updatePatConnection, {
                bootcampId,
                sourcePatEncrypted: 'new.iv.tag.ciphertext',
            })
        ).rejects.toThrow('no está conectado');
    });
});

describe('getBootcampSyncMeta', () => {
    it('throws when the caller is not authenticated', async () => {
        const t = newTestContext();
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        await expect(t.query(api.courseImport.getBootcampSyncMeta, { bootcampId })).rejects.toThrow(
            'permisos'
        );
    });
});

describe('recordSyncFailure', () => {
    it('records the failure status and message on the bootcamp', async () => {
        const t = newTestContext();
        const { bootcampId } = await t.mutation(api.courseImport.applyImport, {
            course: COURSE,
            connection: CONNECTION,
            modulesToCreate: [],
            modulesToUpdate: [],
            modulesToDelete: [],
            lessonsToCreate: [],
            lessonsToUpdate: [],
            lessonsToDelete: [],
        });

        await t.mutation(api.courseImport.recordSyncFailure, {
            bootcampId,
            error: 'GitHub respondió 401',
        });

        const bootcamp = await t.query(api.bootcamps.getById, { id: bootcampId });
        expect(bootcamp?.lastSyncStatus).toBe('error');
        expect(bootcamp?.lastSyncError).toBe('GitHub respondió 401');
    });
});
