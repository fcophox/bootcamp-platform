import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
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

    // The regression: the same hardcoded list existed as THREE separate
    // literals -- utils/roles.ts, convex/users.ts and convex/legacyAuth.ts --
    // and they had drifted. The Convex ones (which gate /cms server-side and
    // drive the sidebar client-side) were missing an entry, so an admin saw the
    // admin UI render and then downgrade to read-only a second later as the
    // query resolved. Scan the whole repo rather than a hand-maintained list of
    // files, so a fourth copy cannot quietly appear.
    it('no source file outside lib/vipEmails.ts hardcodes a VIP email', () => {
        const files = execSync(
            "git ls-files '*.ts' '*.tsx' | grep -v -e '^lib/vipEmails' -e '.test.ts'",
            { encoding: 'utf8' },
        )
            .split('\n')
            .filter(Boolean);

        expect(files.length).toBeGreaterThan(20); // sanity: the scan found real files

        const offenders: string[] = [];
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            for (const email of Object.keys(VIP_EMAIL_ROLES)) {
                if (source.includes(email)) offenders.push(`${file} hardcodes ${email}`);
            }
        }

        expect(offenders).toEqual([]);
    });
});
