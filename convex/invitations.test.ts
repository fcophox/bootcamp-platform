/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

function newTestContext() {
  return convexTest(schema, import.meta.glob('./**/*.*s'));
}

describe('invitations.acceptInvitation', () => {
  it('enrolls the created account in the invited bootcamp', async () => {
    const t = newTestContext();
    const { id: bootcampId } = await t.mutation(api.db.genericInsert, {
      table: 'bootcamps',
      document: { title: 'Bootcamp Token' },
    });
    const { id: userId } = await t.mutation(api.db.genericInsert, {
      table: 'users',
      document: { email: 'alumno@example.com', name: 'Alumno Token' },
    });
    await t.mutation(api.db.genericInsert, {
      table: 'invitations',
      document: { token: 'token-1', bootcampId, isUsed: false, status: 'pending', expiresAt: Date.now() + 100000 },
    });

    await t.mutation(api.invitations.acceptInvitation, {
      token: 'token-1',
      userEmail: 'Alumno@Example.com',
      userName: 'Alumno Token',
    });

    const enrollments = await t.query(api.db.genericQuery, {
      table: 'BootcampStudent',
      eqFilters: [{ field: 'bootcampId', value: bootcampId }],
    });

    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]).toMatchObject({
      bootcampId,
      userId,
      email: 'alumno@example.com',
      status: 'active',
      name: 'Alumno Token',
    });

    const [user] = await t.query(api.db.genericQuery, {
      table: 'users',
      eqFilters: [{ field: 'id', value: userId }],
    });
    expect(user.role).toBe('alumno');
  });

  it('links and activates an existing invited enrollment', async () => {
    const t = newTestContext();
    const { id: bootcampId } = await t.mutation(api.db.genericInsert, {
      table: 'bootcamps',
      document: { title: 'Bootcamp Existing' },
    });
    const { id: userId } = await t.mutation(api.db.genericInsert, {
      table: 'users',
      document: { email: 'existente@example.com', name: 'Alumno Existente' },
    });
    await t.mutation(api.db.genericInsert, {
      table: 'BootcampStudent',
      document: { bootcampId, email: 'existente@example.com', status: 'invited' },
    });
    await t.mutation(api.db.genericInsert, {
      table: 'invitations',
      document: { token: 'token-2', bootcampId, isUsed: false, status: 'pending', expiresAt: Date.now() + 100000 },
    });

    await t.mutation(api.invitations.acceptInvitation, {
      token: 'token-2',
      userEmail: 'existente@example.com',
      userName: 'Alumno Existente',
    });

    const enrollments = await t.query(api.db.genericQuery, {
      table: 'BootcampStudent',
      eqFilters: [{ field: 'bootcampId', value: bootcampId }],
    });

    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].userId).toBe(userId);
    expect(enrollments[0].status).toBe('active');
  });

  it('can recover a pending token after the account already exists', async () => {
    const t = newTestContext();
    const { id: bootcampId } = await t.mutation(api.db.genericInsert, {
      table: 'bootcamps',
      document: { title: 'Bootcamp Recovery' },
    });
    const { id: userId } = await t.mutation(api.db.genericInsert, {
      table: 'users',
      document: { email: 'cinco@gmail.com', name: 'cinco', role: 'alumno' },
    });
    await t.mutation(api.db.genericInsert, {
      table: 'invitations',
      document: { token: 'pending-token', bootcampId, isUsed: false, status: 'pending', expiresAt: Date.now() + 100000 },
    });

    await t.mutation(api.invitations.acceptInvitation, {
      token: 'pending-token',
      userEmail: 'cinco@gmail.com',
      userName: 'cinco',
    });

    const enrollments = await t.query(api.db.genericQuery, {
      table: 'BootcampStudent',
      eqFilters: [{ field: 'bootcampId', value: bootcampId }],
    });
    const invitation = await t.query(api.invitations.getByToken, { token: 'pending-token' });
    const dashboard = await t.query(api.dashboard.getStudentData, { email: 'cinco@gmail.com' });

    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]).toMatchObject({
      bootcampId,
      userId,
      email: 'cinco@gmail.com',
      status: 'active',
    });
    expect(invitation?.isUsed).toBe(true);
    expect(invitation?.usedBy).toBe('cinco@gmail.com');
    expect(dashboard.bootcamps.map((bootcamp) => bootcamp.title)).toContain('Bootcamp Recovery');
  });
});
