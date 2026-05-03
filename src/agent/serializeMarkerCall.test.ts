import { describe, test, expect } from 'bun:test';
import serializeMarkerCallFn from './serializeMarkerCall';
const serializeMarkerCall = (call: any) => serializeMarkerCallFn(null as any, { call });

describe('agent.serializeMarkerCall', () => {
    test('eval', () => {
        expect(serializeMarkerCall({ kind: 'eval', content: '2 + 2' })).toBe('§eval\n2 + 2');
    });

    test('write keeps path', () => {
        expect(serializeMarkerCall({ kind: 'write', path: 'src/foo.ts', content: 'export default 1;' }))
            .toBe('§write:src/foo.ts\nexport default 1;');
    });

    test('bash', () => {
        expect(serializeMarkerCall({ kind: 'bash', content: 'ls -la' })).toBe('§bash\nls -la');
    });

    test('html', () => {
        expect(serializeMarkerCall({ kind: 'html', content: '<div>x</div>' })).toBe('§html\n<div>x</div>');
    });

    test('multi-line content preserved verbatim', () => {
        const body = 'function () {\n  return 1;\n}';
        expect(serializeMarkerCall({ kind: 'eval', content: body })).toBe(`§eval\n${body}`);
    });
});
