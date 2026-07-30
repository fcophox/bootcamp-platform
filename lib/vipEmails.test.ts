import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { VIP_EMAIL_ROLES, getVipRole } from './vipEmails';
import { getRoleFromEmail } from '@/utils/roles';

describe('VIP email overrides', () => {
    it('resolves each configured email to its role', () => {
        for (const [email, role] of Object.entries(VIP_EMAIL_ROLES)) {
            expect(getVipRole(email)).toBe(role);
        }
    });

    it('is case- and whitespace-insensitive', () => {
        const [email, role] = Object.entries(VIP_EMAIL_ROLES)[0];
        expect(getVipRole(`  ${email.toUpperCase()}  `)).toBe(role);
    });

    it('returns null for everyone else', () => {
        expect(getVipRole('nobody@example.com')).toBeNull();
        expect(getVipRole(undefined)).toBeNull();
        expect(getVipRole('')).toBeNull();
    });

    it('gives the Next.js path the same answer as the shared list', () => {
        for (const [email, role] of Object.entries(VIP_EMAIL_ROLES)) {
            expect(getRoleFromEmail(email)).toBe(role);
        }
    });

    // The regression: convex/users.ts and utils/roles.ts each held their own
    // literal list. The Convex one -- which is what actually gates /cms via
    // getCurrentUserWithRole -- was missing an entry, so that account was
    // treated as `alumno` and bounced to /dashboard while the rest of the app
    // considered it a superadmin.
    it('neither role path re-declares its own hardcoded email list', () => {
        for (const file of ['convex/users.ts', 'utils/roles.ts']) {
            const source = readFileSync(file, 'utf8');
            expect(source).toContain('vipEmails');
            for (const email of Object.keys(VIP_EMAIL_ROLES)) {
                expect(
                    source.includes(`'${email}'`) || source.includes(`"${email}"`),
                    `${file} hardcodes ${email} instead of using lib/vipEmails.ts`,
                ).toBe(false);
            }
        }
    });
});
