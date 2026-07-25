import { describe, it, expect } from 'vitest';
import { formatVersionLabel } from './version';

describe('formatVersionLabel', () => {
    it('returns null when there is no version', () => {
        expect(formatVersionLabel(undefined, 'production')).toBeNull();
        expect(formatVersionLabel('', 'production')).toBeNull();
    });

    it('shows a clean version with no env/commit info in production', () => {
        expect(formatVersionLabel('1.2.3', 'production', 'abc1234')).toBe('v1.2.3');
    });

    it('always ignores commit in production, even if provided', () => {
        expect(formatVersionLabel('1.2.3', 'production', 'deadbeef')).toBe('v1.2.3');
    });

    it('shows "(dev)" with no commit in development', () => {
        expect(formatVersionLabel('1.2.3', 'development')).toBe('v1.2.3 (dev)');
        expect(formatVersionLabel('1.2.3', 'development', '')).toBe('v1.2.3 (dev)');
    });

    it('shows the short commit in development when provided', () => {
        expect(formatVersionLabel('1.2.3', 'development', 'abc1234')).toBe('v1.2.3 (dev · abc1234)');
    });

    it('treats any appEnv other than exactly "development" as the clean/prod format', () => {
        // Matches the reference implementation exactly: only the literal string
        // "development" takes the dev branch: unset/unknown values fall through
        // to the same clean label production gets. This is a purely cosmetic
        // label, unlike utils/env.ts's isProdEnv() (which fail-safes the other
        // way, toward "development", for the security/tracking-sensitive gates
        // it drives — noindex, Clarity). Different concerns, different defaults.
        expect(formatVersionLabel('1.2.3', undefined, 'abc1234')).toBe('v1.2.3');
        expect(formatVersionLabel('1.2.3', 'staging', 'abc1234')).toBe('v1.2.3');
    });
});
