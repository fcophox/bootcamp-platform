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
        server: { deps: { inline: ['convex-test'] } },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            // server-only's default export throws unless a bundler applies
            // Next's "react-server" condition; vitest doesn't, so alias it
            // to the package's own no-op build for tests.
            'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
        },
    },
});
