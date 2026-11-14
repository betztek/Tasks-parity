import path from 'node:path';
import tasksConfig from '../vendor/obsidian-tasks/vitest.config';
import ourConfig, { TASKS_DIR } from '../vitest.config';

// Guard: our vitest.config.ts mirrors upstream's. If a Tasks version bump changes
// upstream's mock, setup files or global setup, this fails so we re-mirror.
describe('vitest config mirrors upstream Tasks', () => {
    const abs = (p: string) => (p.startsWith('.') ? path.resolve(TASKS_DIR, p) : p);

    it('aliases obsidian to the same mock', () => {
        const theirs = (tasksConfig.resolve?.alias as Record<string, string>).obsidian;
        const ours = (ourConfig.resolve?.alias as Record<string, string>).obsidian;
        expect(ours).toEqual(theirs);
    });

    it('uses the same setup files and global setup', () => {
        expect(ourConfig.test?.setupFiles).toEqual((tasksConfig.test?.setupFiles as string[]).map(abs));
        expect(ourConfig.test?.globalSetup).toEqual(abs(tasksConfig.test?.globalSetup as string));
        expect(ourConfig.test?.environment).toEqual(tasksConfig.test?.environment);
    });
});
