/**
 * Type declaration for the one @convex-dev/auth internal that proxy.test.ts
 * asserts against.
 *
 * `isCorsRequest` is the predicate that decides whether /api/auth gets a
 * 403 "Invalid origin" and whether `validateCors` strips the auth cookies off
 * a request. proxy.ts exists purely to keep it returning false behind Traefik,
 * so the tests exercise the library's real implementation rather than a copy
 * that could silently drift from it. The package's "exports" map doesn't
 * expose the module, hence this declaration (and the matching alias in
 * vitest.config.ts).
 *
 * Mirrors node_modules/@convex-dev/auth/dist/nextjs/server/utils.d.ts.
 */
declare module '@convex-dev/auth/dist/nextjs/server/utils.js' {
    import type { NextRequest } from 'next/server';

    export function isCorsRequest(request: NextRequest): boolean;
}
