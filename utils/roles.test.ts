import { describe, it, expect } from 'vitest';
import { getRoleFromEmail } from './roles';

describe('getRoleFromEmail', () => {
    it('returns the role from metadata when present', () => {
        expect(getRoleFromEmail('anyone@example.com', { role: 'superadmin' })).toBe('superadmin');
        expect(getRoleFromEmail('anyone@example.com', { role: 'docente' })).toBe('docente');
        expect(getRoleFromEmail('anyone@example.com', { role: 'alumno' })).toBe('alumno');
    });

    it('ignores unrecognized metadata role values and falls through', () => {
        expect(getRoleFromEmail('random@example.com', { role: 'not-a-real-role' })).toBe('alumno');
    });

    it('falls back to the hardcoded superadmin email when metadata has no role', () => {
        expect(getRoleFromEmail('fcojhormazabalh@gmail.com')).toBe('superadmin');
        expect(getRoleFromEmail('dpinto@cleveritgroup.com')).toBe('superadmin');
    });

    it('falls back to the hardcoded docente email when metadata has no role', () => {
        expect(getRoleFromEmail('docente@cleverex.com')).toBe('docente');
    });

    it('matches the hardcoded VIP emails case-insensitively', () => {
        expect(getRoleFromEmail('FCOJHORMAZABALH@GMAIL.COM')).toBe('superadmin');
        expect(getRoleFromEmail('DPINTO@CLEVERITGROUP.COM')).toBe('superadmin');
        expect(getRoleFromEmail('Docente@CleverEx.com')).toBe('docente');
    });

    it('defaults to alumno for an unrecognized email with no metadata', () => {
        expect(getRoleFromEmail('student@example.com')).toBe('alumno');
    });

    it('defaults to alumno when email is undefined or null', () => {
        expect(getRoleFromEmail(undefined)).toBe('alumno');
        expect(getRoleFromEmail(null)).toBe('alumno');
    });

    it('metadata role takes priority over the hardcoded VIP email fallback', () => {
        // A VIP email explicitly tagged as alumno in metadata should NOT be silently upgraded.
        expect(getRoleFromEmail('fcojhormazabalh@gmail.com', { role: 'alumno' })).toBe('alumno');
    });

    it('ignores malformed metadata without throwing', () => {
        expect(getRoleFromEmail('student@example.com', 'not-an-object')).toBe('alumno');
        expect(getRoleFromEmail('student@example.com', null)).toBe('alumno');
        expect(getRoleFromEmail('student@example.com', undefined)).toBe('alumno');
    });
});
