import moment from 'moment';
import { toggleLine } from '../vendor/obsidian-tasks/src/Commands/ToggleDone';
import { GlobalFilter } from '../vendor/obsidian-tasks/src/Config/GlobalFilter';
import { getSettings, resetSettings, updateSettings } from '../vendor/obsidian-tasks/src/Config/Settings';
import { TasksFile } from '../vendor/obsidian-tasks/src/Scripting/TasksFile';
import { StatusRegistry } from '../vendor/obsidian-tasks/src/Statuses/StatusRegistry';
import { Task } from '../vendor/obsidian-tasks/src/Task/Task';
import { TaskLocation } from '../vendor/obsidian-tasks/src/Task/TaskLocation';
import { type Case, type CaseSettings, SETTING_KEYS } from './caseFile';
import { type TaskFields, taskToFields } from './taskFields';

// Upstream tests do the same: Tasks code calls window.moment().
window.moment = moment;

/** File path given to Tasks for every case. Tasks needs one; no case depends on it. */
const CASE_PATH = 'parity/case.md';

export type ResolvedSettings = Required<CaseSettings>;

export interface CaseOutput extends Case {
    settings: ResolvedSettings;
    expected: {
        lines?: string[];
        tasks: (TaskFields | null)[];
    };
}

/**
 * Put Tasks' global state (settings, global filter, status registry) into a
 * known state for one case, and return the fully resolved settings.
 */
function applySettings(overrides: CaseSettings): ResolvedSettings {
    resetSettings();
    updateSettings(overrides);
    const s = getSettings();
    // The plugin mirrors these two settings into the GlobalFilter singleton (src/main.ts).
    GlobalFilter.getInstance().set(s.globalFilter);
    GlobalFilter.getInstance().setRemoveGlobalFilter(s.removeGlobalFilter);
    StatusRegistry.getInstance().resetToDefaultStatuses();
    return Object.fromEntries(SETTING_KEYS.map((k) => [k, s[k]])) as ResolvedSettings;
}

function parseLine(line: string): Task | null {
    return Task.fromLine({
        line,
        taskLocation: TaskLocation.fromUnknownPosition(new TasksFile(CASE_PATH)),
        fallbackDate: null,
    });
}

const fieldsOf = (t: Task | null) => (t ? taskToFields(t) : null);

/**
 * Run one case through real Tasks code with the clock pinned to case.today.
 * Each operation maps to the upstream entry point a user action goes through.
 */
export function runCase(c: Case): CaseOutput {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Noon local time (TZ=UTC via upstream global-setup): far from any day boundary.
    vi.setSystemTime(new Date(`${c.today}T12:00:00`));
    try {
        const settings = applySettings(c.settings);
        const expected = runOperation(c);
        return { ...c, settings, expected };
    } finally {
        vi.useRealTimers();
        applySettings({});
    }
}

function runOperation(c: Case): CaseOutput['expected'] {
    const lines = c.input.lines;
    switch (c.operation) {
        case 'parse':
            return { tasks: lines.map((l) => fieldsOf(parseLine(l))) };

        case 'serialize-roundtrip': {
            const tasks = lines.map(parseLine);
            return {
                lines: tasks.map((t, i) => (t ? t.toFileLineString() : lines[i])),
                tasks: tasks.map(fieldsOf),
            };
        }

        case 'toggle': {
            // The "Tasks: Toggle task done" command. Clicking a checkbox in Reading
            // or Live Preview calls the same Task.toggleWithRecurrenceInUsersOrder().
            const { text } = toggleLine(lines[0], CASE_PATH);
            const out = text.split('\n');
            return { lines: out, tasks: out.map((l) => fieldsOf(parseLine(l))) };
        }

        case 'set-status': {
            const task = parseLine(lines[0]);
            if (!task) return { lines: [...lines], tasks: [null] };
            const status = StatusRegistry.getInstance().bySymbolOrCreate(c.input.newStatusSymbol!);
            const result = task.handleNewStatusWithRecurrenceInUsersOrder(status, moment());
            return { lines: result.map((t) => t.toFileLineString()), tasks: result.map(fieldsOf) };
        }
    }
}
