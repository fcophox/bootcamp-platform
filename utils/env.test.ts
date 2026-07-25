import { describe, it, expect, afterEach } from 'vitest';
import { getAppEnv, isProdEnv } from './env';

const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
    else process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
});

describe('getAppEnv / isProdEnv', () => {
    it('treats an unset env var as development', () => {
        delete process.env.NEXT_PUBLIC_APP_ENV;
        expect(getAppEnv()).toBe('development');
        expect(isProdEnv()).toBe(false);
    });

    it('treats any non-"production" value as development (fail-safe default)', () => {
        process.env.NEXT_PUBLIC_APP_ENV = 'staging';
        expect(getAppEnv()).toBe('development');
        expect(isProdEnv()).toBe(false);
    });

    it('recognizes "production" exactly', () => {
        process.env.NEXT_PUBLIC_APP_ENV = 'production';
        expect(getAppEnv()).toBe('production');
        expect(isProdEnv()).toBe(true);
    });
});
