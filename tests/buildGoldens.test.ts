import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildGoldens, tasksVersion } from '../generator/buildGoldens';

function dirWith(files: Record<string, unknown>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cases-'));
    for (const [name, json] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(json));
    return dir;
}
const c = (id: string) => ({ id, description: 'd', operation: 'parse', today: '2026-01-01', input: { lines: ['- [ ] a'] } });

describe('buildGoldens', () => {
    it('stamps the pinned Tasks version and commit', () => {
        const out = buildGoldens(dirWith({ 'a.json': { cases: [c('a')] } }));
        expect(out.schema_version).toEqual(1);
        expect(out.tasks_version).toEqual(tasksVersion().version);
        expect(out.tasks_commit).toMatch(/^[0-9a-f]{40}$/);
    });

    it('collects all case files and sorts cases by id for stable diffs', () => {
        const out = buildGoldens(dirWith({ 'b.json': { cases: [c('zeta'), c('alpha')] }, 'a.json': { cases: [c('mid')] } }));
        expect(out.cases.map((x) => x.id)).toEqual(['alpha', 'mid', 'zeta']);
    });

    it('rejects duplicate ids across files', () => {
        expect(() => buildGoldens(dirWith({ 'a.json': { cases: [c('x')] }, 'b.json': { cases: [c('x')] } }))).toThrow(
            /duplicate/,
        );
    });
});
