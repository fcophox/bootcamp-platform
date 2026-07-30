import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isCorsRequest } from '@convex-dev/auth/dist/nextjs/server/utils.js';

import { EXTERNAL_ORIGIN_HEADER, normalizeExternalOrigin } from './proxy';

/**
 * Regression tests for the reverse-proxy origin reconciliation in proxy.ts.
 *
 * The fixture below mirrors headers MEASURED on bootcamp-dev.nodrize.dev, not
 * assumed ones — an earlier version of these tests passed against an invented
 * "Traefik rewrites Host to the service name" scenario that does not happen,
 * and the fix it validated did nothing in production. Ground truth:
 *
 *   Host:              bootcamp-dev.nodrize.dev   (already correct)
 *   X-Forwarded-Host:  bootcamp-dev.nodrize.dev
 *   X-Forwarded-Proto: http                       (Cloudflare -> Traefik hop)
 *   Origin:            https://bootcamp-dev.nodrize.dev
 *   request.url:       http://0.0.0.0:3000/...    (raw internal socket)
 *
 * Only the protocol mismatches, and that alone makes @convex-dev/auth's
 * `isCorsRequest` return true — which 403s /api/auth and makes validateCors
 * strip the auth cookies off everything else.
 */

const EXTERNAL_HOST = 'bootcamp-dev.nodrize.dev';
const EXTERNAL_ORIGIN = `https://${EXTERNAL_HOST}`;
const INTERNAL_URL_BASE = 'http://0.0.0.0:3000';

function behindCloudflareAndTraefik(
    path: string,
    {
        method = 'POST',
        body,
        origin = EXTERNAL_ORIGIN,
        hostHeader = EXTERNAL_HOST,
        internalBase = INTERNAL_URL_BASE,
    }: {
        method?: string;
        body?: string;
        origin?: string | null;
        hostHeader?: string;
        internalBase?: string;
    } = {},
) {
    const headers = new Headers({
        host: hostHeader,
        'x-forwarded-host': EXTERNAL_HOST,
        'x-forwarded-proto': 'http',
        'x-forwarded-port': '80',
        'cf-visitor': '{"scheme":"https"}',
    });
    if (origin) headers.set('origin', origin);

    return new NextRequest(`${internalBase}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
    });
}

describe('normalizeExternalOrigin', () => {
    describe('/api/auth — consumed by the middleware, must pass isCorsRequest', () => {
        it('is not treated as a CORS request by @convex-dev/auth', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/auth', { body: '{"action":"auth:signIn"}' }),
            );

            expect(isCorsRequest(normalized)).toBe(false);
        });

        it("rebuilds the URL on the browser's protocol, not x-forwarded-proto", async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/auth', { body: '{}' }),
            );

            // x-forwarded-proto is "http" here; using it is what caused the
            // 403 "Invalid origin" login regression.
            const url = new URL(normalized.url);
            expect(url.protocol).toBe('https:');
            expect(url.host).toBe(EXTERNAL_HOST);
        });

        it('keeps the Host header on the external host', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/auth', {
                    body: '{}',
                    // Defensive: some proxies really do pass an internal Host.
                    hostHeader: 'bootcamp-platform-dev:3000',
                }),
            );

            expect(normalized.headers.get('host')).toBe(EXTERNAL_HOST);
            expect(isCorsRequest(normalized)).toBe(false);
        });

        it('preserves the request body for proxyAuthActionToConvex', async () => {
            const body = '{"action":"auth:signIn","args":{"provider":"password"}}';
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/auth', { body }),
            );

            await expect(normalized.text()).resolves.toBe(body);
        });

        it('preserves the query string (OAuth / magic-link code exchange)', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/auth?code=abc123', { body: '{}' }),
            );

            expect(new URL(normalized.url).search).toBe('?code=abc123');
        });
    });

    describe('other routes — must keep auth cookies through validateCors', () => {
        it('is not treated as a CORS request on POST /api/presence', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/presence'),
            );

            expect(isCorsRequest(normalized)).toBe(false);
        });

        it('is not treated as a CORS request on a server-action POST', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/cms/bootcamp/create', {
                    body: 'server-action-payload',
                }),
            );

            expect(isCorsRequest(normalized)).toBe(false);
        });

        it('does not consume the body (server actions still read it downstream)', async () => {
            const body = 'server-action-payload';
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/cms/bootcamp/create', { body }),
            );

            expect(normalized.bodyUsed).toBe(false);
            await expect(normalized.text()).resolves.toBe(body);
        });

        it("preserves the browser's real origin for outbound links", async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/cms/estudiantes'),
            );

            // Invitation emails must not inherit the stepped-down http scheme.
            expect(normalized.headers.get(EXTERNAL_ORIGIN_HEADER)).toBe(EXTERNAL_ORIGIN);
            expect(normalized.headers.get('origin')).toBe(`http://${EXTERNAL_HOST}`);
        });

        it('leaves Next’s server-action CSRF check satisfiable (origin host unchanged)', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/cms/bootcamp/create', { body: 'x' }),
            );

            // Next compares Origin's *host* against x-forwarded-host.
            expect(new URL(normalized.headers.get('origin')!).host).toBe(
                normalized.headers.get('x-forwarded-host'),
            );
        });
    });

    describe('cross-origin requests are still rejected', () => {
        it('leaves a foreign Origin untouched on a normal route', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/presence', {
                    origin: 'https://evil.example.com',
                }),
            );

            expect(normalized.headers.get('origin')).toBe('https://evil.example.com');
            expect(normalized.headers.get(EXTERNAL_ORIGIN_HEADER)).toBeNull();
            expect(isCorsRequest(normalized)).toBe(true);
        });

        it('leaves a foreign Origin untouched on /api/auth', async () => {
            const normalized = await normalizeExternalOrigin(
                behindCloudflareAndTraefik('/api/auth', {
                    body: '{}',
                    origin: 'https://evil.example.com',
                }),
            );

            expect(isCorsRequest(normalized)).toBe(true);
        });
    });

    describe('no-op cases', () => {
        it('returns the request untouched when there is no Origin header', async () => {
            const request = behindCloudflareAndTraefik('/api/presence', { origin: null });

            const normalized = await normalizeExternalOrigin(request);

            expect(normalized).toBe(request);
            expect(isCorsRequest(normalized)).toBe(false);
        });

        it('returns the request untouched when protocols already agree (local dev)', async () => {
            const request = new NextRequest('http://localhost:3000/api/presence', {
                method: 'POST',
                headers: new Headers({
                    host: 'localhost:3000',
                    origin: 'http://localhost:3000',
                }),
            });

            const normalized = await normalizeExternalOrigin(request);

            expect(normalized).toBe(request);
            expect(normalized.headers.get(EXTERNAL_ORIGIN_HEADER)).toBeNull();
            expect(isCorsRequest(normalized)).toBe(false);
        });

        it('ignores a malformed Origin header instead of throwing', async () => {
            const request = behindCloudflareAndTraefik('/api/presence', {
                origin: 'not a url',
            });

            await expect(normalizeExternalOrigin(request)).resolves.toBe(request);
        });
    });
});
