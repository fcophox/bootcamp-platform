/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

function newTestContext() {
  return convexTest(schema, import.meta.glob('./**/*.*s'));
}

describe('users.listAllUsersWithRoles', () => {
  it('no longer lists a user after native and legacy records are removed', async () => {
    const t = newTestContext();
    const { id: bootcampId } = await t.mutation(api.db.genericInsert, {
      table: 'bootcamps',
      document: { title: 'Bootcamp Usuarios' },
    });
    const { id: userId } = await t.mutation(api.db.genericInsert, {
      table: 'users',
      document: { email: 'borrar@example.com', name: 'Borrar', role: 'alumno' },
    });
    await t.mutation(api.db.genericInsert, {
      table: 'legacyAuth',
      document: { email: 'borrar@example.com', passwordHash: 'hash', role: 'alumno', migrated: true },
    });
    const { id: enrollmentId } = await t.mutation(api.db.genericInsert, {
      table: 'BootcampStudent',
      document: { bootcampId, userId, email: 'borrar@example.com', status: 'invited' },
    });

    await t.run(async (ctx) => {
      const userDocId = ctx.db.normalizeId('users', userId);
      const enrollmentDocId = ctx.db.normalizeId('bootcampStudents', enrollmentId);
      if (!userDocId || !enrollmentDocId) throw new Error('Invalid test ids');

      const legacyUsers = await ctx.db.query('legacyAuth').collect();
      const legacyUser = legacyUsers.find((user) => user.email === 'borrar@example.com');
      if (!legacyUser) throw new Error('Missing legacy user');

      await ctx.db.delete(userDocId);
      await ctx.db.delete(legacyUser._id);
      await ctx.db.delete(enrollmentDocId);
    });

    const users = await t.query(api.users.listAllUsersWithRoles, {});

    expect(users.some((user) => user.email === 'borrar@example.com')).toBe(false);
  });
});

describe('users.associateUserToBootcamp', () => {
  it('creates an active enrollment with normalized bootcamp id', async () => {
    const t = newTestContext();
    const { id: bootcampId } = await t.mutation(api.db.genericInsert, {
      table: 'bootcamps',
      document: { title: 'Bootcamp Asociado', icon: 'zap', legacyId: 456 },
    });
    const { id: userId } = await t.mutation(api.db.genericInsert, {
      table: 'users',
      document: { email: 'asociado@example.com', name: 'Asociado', role: 'alumno' },
    });

    const result = await t.mutation(api.users.associateUserToBootcamp, {
      userId,
      email: 'Asociado@Example.com',
      bootcampId,
    });

    const enrollments = await t.query(api.db.genericQuery, {
      table: 'BootcampStudent',
      eqFilters: [{ field: 'bootcampId', value: bootcampId }],
    });
    const dashboard = await t.query(api.dashboard.getStudentData, { email: 'asociado@example.com' });

    expect(result.bootcamp).toMatchObject({ id: bootcampId, title: 'Bootcamp Asociado', icon: 'zap' });
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]).toMatchObject({
      bootcampId,
      userId,
      email: 'asociado@example.com',
      status: 'active',
      legacyBootcampId: 456,
    });
    expect(dashboard.bootcamps.map((bootcamp) => bootcamp.title)).toContain('Bootcamp Asociado');
  });

  it('rejects duplicate associations for the same email and bootcamp', async () => {
    const t = newTestContext();
    const { id: bootcampId } = await t.mutation(api.db.genericInsert, {
      table: 'bootcamps',
      document: { title: 'Bootcamp Duplicado' },
    });
    const { id: userId } = await t.mutation(api.db.genericInsert, {
      table: 'users',
      document: { email: 'duplicado@example.com', name: 'Duplicado', role: 'alumno' },
    });

    await t.mutation(api.users.associateUserToBootcamp, {
      userId,
      email: 'duplicado@example.com',
      bootcampId,
    });

    await expect(t.mutation(api.users.associateUserToBootcamp, {
      userId,
      email: 'duplicado@example.com',
      bootcampId,
    })).rejects.toThrow('Este usuario ya está asociado a ese bootcamp.');
  });
});
