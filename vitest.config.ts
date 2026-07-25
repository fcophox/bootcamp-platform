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
        },
    },
});
