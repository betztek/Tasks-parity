import { parseCaseFile, validateUniqueIds } from '../generator/caseFile';

const valid = {
    id: 'parse-simple',
    description: 'a simple task',
    operation: 'parse',
    today: '2026-11-14',
    input: { lines: ['- [ ] hello'] },
};

describe('parseCaseFile', () => {
    it('accepts a valid case and fills default settings to {}', () => {
        const [c] = parseCaseFile({ cases: [valid] }, 'x.json');
        expect(c.id).toEqual('parse-simple');
        expect(c.settings).toEqual({});
    });

    it.each([
        ['unknown operation', { ...valid, operation: 'explode' }, /operation/],
        ['bad today', { ...valid, today: '14/11/2026' }, /today/],
        ['bad id', { ...valid, id: 'Has Spaces' }, /id/],
        ['no lines', { ...valid, input: { lines: [] } }, /lines/],
        ['toggle with two lines', { ...valid, operation: 'toggle', input: { lines: ['a', 'b'] } }, /exactly one/],
        ['set-status without symbol', { ...valid, operation: 'set-status' }, /newStatusSymbol/],
        ['unknown setting', { ...valid, settings: { globalFiltre: '#task' } }, /globalFiltre/],
    ])('rejects %s', (_name, bad, message) => {
        expect(() => parseCaseFile({ cases: [bad] }, 'x.json')).toThrow(message);
    });

    it('names the file in errors', () => {
        expect(() => parseCaseFile({ cases: [{ ...valid, id: '' }] }, 'cases/foo.json')).toThrow(/cases\/foo.json/);
    });
});

describe('validateUniqueIds', () => {
    it('rejects duplicate ids', () => {
        const c = parseCaseFile({ cases: [valid] }, 'x.json');
        expect(() => validateUniqueIds([...c, ...c])).toThrow(/duplicate.*parse-simple/i);
    });
});
