import { describe, test, expect } from 'bun:test';
import parseReadMarkerFn from './parseReadMarker';
const parseReadMarker = (body: string) => parseReadMarkerFn(null as any, { body });

describe('agent.parseReadMarker', () => {
    test('plain body path shorthand', () => {
        expect(parseReadMarker('src/foo.ts')).toEqual({ path: 'src/foo.ts' });
    });

    test('structured body path only', () => {
        expect(parseReadMarker('path: src/foo.ts')).toEqual({ path: 'src/foo.ts' });
    });

    test('structured body with range', () => {
        expect(parseReadMarker([
            'path: src/foo.ts',
            'startLine: 10',
            'endLine: 20',
        ].join('\n'))).toEqual({ path: 'src/foo.ts', startLine: 10, endLine: 20 });
    });

    test('structured body with maxLines', () => {
        expect(parseReadMarker([
            'path: src/foo.ts',
            'maxLines: 80',
        ].join('\n'))).toEqual({ path: 'src/foo.ts', maxLines: 80 });
    });

    test('missing path throws', () => {
        expect(() => parseReadMarker('startLine: 10')).toThrow(/path/);
    });

    test('multi-line body without path: prefix throws (no more ENOENT on `<path>\\nmaxLines: 10`)', () => {
        // This was the live bug: model wrote
        //   §read
        //   src/agent/$route_new_GET.ts
        //   maxLines: 10
        // and parseReadMarker treated the whole thing as path -> ENOENT.
        // Now we throw with a useful message instead.
        expect(() => parseReadMarker([
            'src/agent/$route_new_GET.ts',
            'maxLines: 10',
        ].join('\n'))).toThrow(/missing 'key: value'/);
    });

    test('unknown key throws with allowed list', () => {
        expect(() => parseReadMarker('path: x.ts\nlimit: 10')).toThrow(/unknown key "limit"/);
    });

    test('non-numeric maxLines throws with field name', () => {
        expect(() => parseReadMarker('path: x.ts\nmaxLines: ten')).toThrow(/maxLines must be a number/);
    });

    test('duplicate key throws', () => {
        expect(() => parseReadMarker('path: a.ts\npath: b.ts')).toThrow(/duplicate key "path"/);
    });

    test('whitespace-only body throws', () => {
        expect(() => parseReadMarker('   \n\n  ')).toThrow(/path/);
    });

    test('single-line path with colons inside (e.g. URL-ish path) is accepted as-is', () => {
        // Edge case: paths containing `:` (rare but possible) shouldn't be
        // mistaken for kv blocks just because of the colon.
        expect(parseReadMarker('path/to:weird.txt')).toEqual({ path: 'path/to:weird.txt' });
    });
});