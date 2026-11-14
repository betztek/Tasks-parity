import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { type Case, parseCaseFile, validateUniqueIds } from './caseFile';
import { type CaseOutput, runCase } from './runCase';

export const SCHEMA_VERSION = 1;
const TASKS_DIR = path.resolve(__dirname, '../vendor/obsidian-tasks');

export interface Goldens {
    schema_version: number;
    tasks_version: string;
    tasks_commit: string;
    cases: CaseOutput[];
}

/** Version and commit of the Tasks checkout the goldens were produced from. */
export function tasksVersion(): { version: string; commit: string } {
    const pkg = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, 'package.json'), 'utf8')) as { version: string };
    const commit = execFileSync('git', ['-C', TASKS_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    return { version: pkg.version, commit };
}

export function loadCases(casesDir: string): Case[] {
    const files = fs
        .readdirSync(casesDir)
        .filter((f) => f.endsWith('.json'))
        .sort();
    const cases = files.flatMap((f) =>
        parseCaseFile(JSON.parse(fs.readFileSync(path.join(casesDir, f), 'utf8')), path.join(casesDir, f)),
    );
    validateUniqueIds(cases);
    return cases.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function buildGoldens(casesDir: string): Goldens {
    const { version, commit } = tasksVersion();
    return {
        schema_version: SCHEMA_VERSION,
        tasks_version: version,
        tasks_commit: commit,
        cases: loadCases(casesDir).map(runCase),
    };
}
