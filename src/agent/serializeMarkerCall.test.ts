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

    test('read plain', () => {
        expect(serializeMarkerCall({ kind: 'read', path: 'src/foo.ts', format: 'plain' }))
            .toBe('§read\nsrc/foo.ts');
    });

    test('read hashline', () => {
        expect(serializeMarkerCall({ kind: 'read', path: 'src/foo.ts', format: 'hashline' }))
            .toBe('§read:hashline\nsrc/foo.ts');
    });

    test('grep plain', () => {
        expect(serializeMarkerCall({ kind: 'grep', format: 'plain', content: 'pattern: foo' }))
            .toBe('§grep\npattern: foo');
    });

    test('grep hashline', () => {
        expect(serializeMarkerCall({ kind: 'grep', format: 'hashline', content: 'pattern: foo' }))
            .toBe('§grep:hashline\npattern: foo');
    });

    test('edit hashline', () => {
        expect(serializeMarkerCall({ kind: 'edit', format: 'hashline', content: '@a.ts\n= 1aa\n|x' }))
            .toBe('§edit:hashline\n@a.ts\n= 1aa\n|x');
    });

    test('multi-line content preserved verbatim', () => {
        const body = 'function () {\n  return 1;\n}';
        expect(serializeMarkerCall({ kind: 'eval', content: body })).toBe(`§eval\n${body}`);
    });
});