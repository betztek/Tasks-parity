import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors vendor/obsidian-tasks/vitest.config.ts so Tasks code runs exactly as in
// upstream's own tests: same `obsidian` mock, same setup files, same global setup
// (which forces TZ=UTC). tests/config.test.ts fails if upstream's config drifts
// from what is mirrored here.
//
// Not mirrored: the svelte plugin and `conditions: ['browser']`, which only matter
// for rendering Svelte components. Add them if a case ever needs UI code.

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const TASKS_DIR = path.resolve(dirname, 'vendor/obsidian-tasks');
const t = (p: string) => path.resolve(TASKS_DIR, p);

export default defineConfig({
    resolve: {
        alias: {
            obsidian: t('tests/__mocks__/obsidian.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['tests/**/*.test.ts', 'generator/**/*.gen.ts'],
        setupFiles: [
            t('tests/vitest.setup.ts'),
            t('tests/CustomMatchers/vitest.custom_matchers.setup.ts'),
            'jest-sorted',
        ],
        globalSetup: t('tests/global-setup.js'),
    },
});
