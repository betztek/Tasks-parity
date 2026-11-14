import fs from 'node:fs';
import path from 'node:path';
import { buildGoldens } from './buildGoldens';

// Entry point for `yarn generate`. Runs under vitest only because that is how
// Tasks code runs outside Obsidian (obsidian mock, jsdom, TZ=UTC setup).
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out/parity-cases.json');

it('generates out/parity-cases.json', () => {
    const goldens = buildGoldens(path.join(ROOT, 'cases'));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(goldens, null, 2) + '\n');
    console.log(`wrote ${goldens.cases.length} cases (Tasks ${goldens.tasks_version}) to ${path.relative(ROOT, OUT)}`);
});
