import { parseCaseFile } from '../generator/caseFile';
import { runCase } from '../generator/runCase';

// These tests check the generator's plumbing (settings isolation, date pinning,
// which upstream entry point is used). The behaviour itself always comes from Tasks.

function one(c: Record<string, unknown>) {
    return parseCaseFile({ cases: [{ description: 'test', today: '2023-06-15', ...c }] }, 'test.json')[0];
}

describe('runCase', () => {
    it('parse: reports parsed fields', () => {
        const out = runCase(
            one({ id: 'p', operation: 'parse', input: { lines: ['  - [ ] hello ⏫ 📅 2023-07-01 #tag'] } }),
        );
        expect(out.expected.lines).toBeUndefined();
        expect(out.expected.tasks).toHaveLength(1);
        const t = out.expected.tasks[0]!;
        expect(t.indentation).toEqual('  ');
        expect(t.status).toEqual({ symbol: ' ', name: 'Todo', type: 'TODO', nextStatusSymbol: 'x' });
        expect(t.description).toEqual('hello #tag');
        expect(t.priority).toEqual('high');
        expect(t.dates.due).toEqual('2023-07-01');
        expect(t.dates.scheduled).toBeNull();
        expect(t.tags).toEqual(['#tag']);
    });

    it('parse: non-task lines become null', () => {
        const out = runCase(one({ id: 'p', operation: 'parse', input: { lines: ['just text'] } }));
        expect(out.expected.tasks).toEqual([null]);
    });

    it('serialize-roundtrip: emits the re-serialised line', () => {
        const out = runCase(
            one({ id: 'r', operation: 'serialize-roundtrip', input: { lines: ['- [ ] a 📅 2023-07-01 ⏫'] } }),
        );
        expect(out.expected.lines).toEqual(['- [ ] a ⏫ 📅 2023-07-01']);
    });

    it('toggle: done date is the pinned today, not the real clock', () => {
        const out = runCase(one({ id: 't', operation: 'toggle', input: { lines: ['- [ ] a'] } }));
        expect(out.expected.lines).toEqual(['- [x] a ✅ 2023-06-15']);
    });

    it('settings: global filter applies and does not leak into the next case', () => {
        const filtered = runCase(
            one({ id: 'g1', operation: 'parse', settings: { globalFilter: '#task' }, input: { lines: ['- [ ] a'] } }),
        );
        expect(filtered.expected.tasks).toEqual([null]);
        expect(filtered.settings.globalFilter).toEqual('#task');

        const unfiltered = runCase(one({ id: 'g2', operation: 'parse', input: { lines: ['- [ ] a'] } }));
        expect(unfiltered.expected.tasks[0]).not.toBeNull();
        expect(unfiltered.settings.globalFilter).toEqual('');
    });

    it('emits fully resolved settings so consumers need not know Tasks defaults', () => {
        const out = runCase(one({ id: 's', operation: 'parse', input: { lines: ['- [ ] a'] } }));
        expect(out.settings).toEqual({
            globalFilter: '',
            removeGlobalFilter: false,
            taskFormat: 'tasksPluginEmoji',
            recurrenceOnNextLine: false,
            removeScheduledDateOnRecurrence: false,
            setCreatedDate: false,
            setDoneDate: true,
            setCancelledDate: true,
        });
    });

    it('set-status: applies the status with the pinned today', () => {
        const out = runCase(
            one({ id: 'ss', operation: 'set-status', input: { lines: ['- [ ] a'], newStatusSymbol: '-' } }),
        );
        expect(out.expected.lines).toEqual(['- [-] a ❌ 2023-06-15']);
    });
});
