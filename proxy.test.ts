import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isCorsRequest } from '@convex-dev/auth/dist/nextjs/server/utils.js';

import { normalizeExternalHost } from './proxy';

/**
 * Regression tests for the reverse-proxy Host/protocol normalization.
 *
 * Behind Traefik the pod sees an internal Host ("bootcamp-platform-dev:3000")
 * and (potentially) an http:// request URL, while the browser sends
 * Origin: https://bootcamp-dev.nodrize.dev.
 *
 * @convex-dev/auth's `isCorsRequest` returns true when EITHER
 *   - Origin.host !== Host header, OR
 *   - Origin.protocol !== new URL(request.url).protocol
 *
 * When it returns true, `proxyAuthActionToConvex` answers 403 "Invalid origin"
 * on /api/auth, and `validateCors` silently strips the auth cookies off every
 * other request. Both symptoms shipped to dev before these tests existed.
 */

const EXTERNAL_HOST = 'bootcamp-dev.nodrize.dev';
const ORIGIN = `https://${EXTERNAL_HOST}`;
const INTERNAL_HOST = 'bootcamp-platform-dev:3000';

function behindTraefik(
    path: string,
    { method = 'POST', body, origin = ORIGIN, internalProtocol = 'http' } = {} as {
        method?: string;
        body?: string;
        origin?: string | null;
        internalProtocol?: string;
    },
) {
    const headers = new Headers({
        host: INTERNAL_HOST,
        'x-forwarded-host': EXTERNAL_HOST,
        'x-forwarded-proto': 'https',
    });
    if (origin) headers.set('origin', origin);

    return new NextRequest(`${internalProtocol}://${INTERNAL_HOST}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
    });
}

describe('normalizeExternalHost', () => {
    describe('/api/auth (proxied to Convex, must pass isCorsRequest)', () => {
        it('rewrites the Host header to the external host', async () => {
            const normalized = await normalizeExternalHost(
                behindTraefik('/api/auth', { body: '{"action":"auth:signIn"}' }),
            );

            expect(normalized.headers.get('host')).toBe(EXTERNAL_HOST);
        });

        it('rewrites the request URL to the external origin', async () => {
            const normalized = await normalizeExternalHost(
                behindTraefik('/api/auth', { body: '{"action":"auth:signIn"}' }),
            );

            const url = new URL(normalized.url);
            expect(url.protocol).toBe('https:');
            expect(url.host).toBe(EXTERNAL_HOST);
        });

        // The actual contract: the real library predicate must not flag it.
        it('is not treated as a CORS request by @convex-dev/auth', async () => {
            const normalized = await normalizeExternalHost(
                behindTraefik('/api/auth', { body: '{"action":"auth:signIn"}' }),
            );

            expect(isCorsRequest(normalized)).toBe(false);
        });

        it('preserves the request body for proxyAuthActionToConvex', async () => {
            const body = '{"action":"auth:signIn","args":{"provider":"password"}}';
            const normalized = await normalizeExternalHost(
                behindTraefik('/api/auth', { body }),
            );

            await expect(normalized.text()).resolves.toBe(body);
        });

        it('preserves the query string', async () => {
            const normalized = await normalizeExternalHost(
                behindTraefik('/api/auth?code=abc123', { body: '{}' }),
            );

            expect(new URL(normalized.url).search).toBe('?code=abc123');
        });
    });

    describe('other routes (must keep auth cookies through validateCors)', () => {
        it('rewrites the Host header on /api/presence', async () => {
            const normalized = await normalizeExternalHost(behindTraefik('/api/presence'));

            expect(normalized.headers.get('host')).toBe(EXTERNAL_HOST);
        });

        it('is not treated as a CORS request by @convex-dev/auth', async () => {
            const normalized = await normalizeExternalHost(behindTraefik('/api/presence'));

            expect(isCorsRequest(normalized)).toBe(false);
        });

        it('is not treated as a CORS request for a server action POST', async () => {
            const normalized = await normalizeExternalHost(
                behindTraefik('/cms/bootcamp/create', { body: 'server-action-payload' }),
            );

            expect(isCorsRequest(normalized)).toBe(false);
        });
    });

    describe('cross-origin requests are still rejected', () => {
        it('leaves a foreign Origin untouched so isCorsRequest still flags it', async () => {
            const normalized = await normalizeExternalHost(
                behindTraefik('/api/presence', { origin: 'https://evil.example.com' }),
            );

            expect(normalized.headers.get('origin')).toBe('https://evil.example.com');
            expect(isCorsRequest(normalized)).toBe(true);
        });

        it('does not rewrite a foreign Origin on /api/auth either', async () => {
            const normalized = await normalizeExternalHost(
                behindTraefik('/api/auth', {
                    body: '{}',
                    origin: 'https://evil.example.com',
                }),
            );

            expect(isCorsRequest(normalized)).toBe(true);
        });
    });

    describe('passthrough', () => {
        it('returns the request untouched when there is no x-forwarded-host', async () => {
            const request = new NextRequest('https://localhost:3000/api/presence', {
                method: 'POST',
                headers: new Headers({ host: 'localhost:3000', origin: 'https://localhost:3000' }),
            });

            const normalized = await normalizeExternalHost(request);

            expect(normalized).toBe(request);
            expect(isCorsRequest(normalized)).toBe(false);
        });
    });
});
