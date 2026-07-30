import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.ts'],
        exclude: ['node_modules', '.next'],
        // convex-test needs its own edge-runtime environment (set per-file via
        // a `// @vitest-environment edge-runtime` docblock) and to be inlined
        // rather than externalized.
        // @convex-dev/auth is inlined too so proxy.test.ts can import its
        // internal `isCorsRequest` (see the alias below) — externalized, its
        // bare "next/server" import fails to resolve under node ESM.
        server: { deps: { inline: ['convex-test', '@convex-dev/auth'] } },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            // server-only's default export throws unless a bundler applies
            // Next's "react-server" condition; vitest doesn't, so alias it
            // to the package's own no-op build for tests.
            'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
            // proxy.test.ts asserts against @convex-dev/auth's real `isCorsRequest`
            // (the predicate that 403s /api/auth and strips auth cookies behind
            // Traefik) rather than a copy of it, but the package's "exports" map
            // doesn't expose the internal module. Alias the deep path directly.
            '@convex-dev/auth/dist/nextjs/server/utils.js': path.resolve(
                __dirname,
                'node_modules/@convex-dev/auth/dist/nextjs/server/utils.js',
            ),
        },
    },
});
