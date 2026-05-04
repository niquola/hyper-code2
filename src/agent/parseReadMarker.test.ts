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
});