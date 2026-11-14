/**
 * Input case files (cases/*.json): parsing and validation.
 * The format is specified in docs/CASE-FORMAT.md; keep the two in sync.
 */

export const OPERATIONS = ['parse', 'serialize-roundtrip', 'toggle', 'set-status'] as const;
export type Operation = (typeof OPERATIONS)[number];

/** Settings a case may override. Anything omitted takes Tasks' own default. */
export interface CaseSettings {
    globalFilter?: string;
    removeGlobalFilter?: boolean;
    taskFormat?: 'tasksPluginEmoji' | 'dataview';
    recurrenceOnNextLine?: boolean;
    removeScheduledDateOnRecurrence?: boolean;
    setCreatedDate?: boolean;
    setDoneDate?: boolean;
    setCancelledDate?: boolean;
}
export const SETTING_KEYS: readonly (keyof CaseSettings)[] = [
    'globalFilter',
    'removeGlobalFilter',
    'taskFormat',
    'recurrenceOnNextLine',
    'removeScheduledDateOnRecurrence',
    'setCreatedDate',
    'setDoneDate',
    'setCancelledDate',
];

export interface CaseInput {
    lines: string[];
    newStatusSymbol?: string;
}

export interface Case {
    id: string;
    description: string;
    operation: Operation;
    today: string;
    settings: CaseSettings;
    input: CaseInput;
    links?: string[];
}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCaseFile(json: unknown, file: string): Case[] {
    const root = json as { cases?: unknown };
    if (!root || !Array.isArray(root.cases)) {
        throw new Error(`${file}: expected an object with a "cases" array`);
    }
    return root.cases.map((raw, i) => parseCase(raw, `${file}: cases[${i}]`));
}

function parseCase(raw: unknown, where: string): Case {
    const fail = (msg: string): never => {
        throw new Error(`${where}: ${msg}`);
    };
    const c = raw as Record<string, unknown>;
    if (!c || typeof c !== 'object') fail('case must be an object');

    const id = c.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) fail(`id must be kebab-case [a-z0-9-], got ${JSON.stringify(id)}`);
    where = `${where} (${id as string})`;

    if (typeof c.description !== 'string' || c.description.trim() === '') fail('description is required');
    if (!OPERATIONS.includes(c.operation as Operation)) {
        fail(`operation must be one of ${OPERATIONS.join(', ')}, got ${JSON.stringify(c.operation)}`);
    }
    const operation = c.operation as Operation;
    if (typeof c.today !== 'string' || !DATE_RE.test(c.today)) fail('today must be YYYY-MM-DD');

    const settings = (c.settings ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(settings)) {
        if (!SETTING_KEYS.includes(key as keyof CaseSettings)) fail(`unknown setting "${key}"`);
    }

    const input = c.input as Record<string, unknown> | undefined;
    const lines = input?.lines;
    if (!Array.isArray(lines) || lines.length === 0 || !lines.every((l) => typeof l === 'string')) {
        fail('input.lines must be a non-empty array of strings');
    }
    if ((operation === 'toggle' || operation === 'set-status') && (lines as string[]).length !== 1) {
        fail(`${operation} takes exactly one input line`);
    }
    if (operation === 'set-status') {
        if (typeof input?.newStatusSymbol !== 'string' || [...input.newStatusSymbol].length !== 1) {
            fail('set-status requires input.newStatusSymbol (a single character)');
        }
    } else if (input?.newStatusSymbol !== undefined) {
        fail('input.newStatusSymbol is only valid for set-status');
    }
    if (c.links !== undefined && (!Array.isArray(c.links) || !c.links.every((l) => typeof l === 'string'))) {
        fail('links must be an array of strings');
    }

    const result: Case = {
        id: id as string,
        description: c.description as string,
        operation,
        today: c.today as string,
        settings: settings as CaseSettings,
        input: { lines: lines as string[] },
    };
    if (operation === 'set-status') result.input.newStatusSymbol = input!.newStatusSymbol as string;
    if (c.links) result.links = c.links as string[];
    return result;
}

export function validateUniqueIds(cases: { id: string }[]): void {
    const seen = new Set<string>();
    for (const { id } of cases) {
        if (seen.has(id)) throw new Error(`duplicate case id: ${id}`);
        seen.add(id);
    }
}
