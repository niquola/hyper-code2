import { describe, test, expect } from 'bun:test';
import parseMarkers from './parseMarkers';

describe('agent.parseMarkers', () => {
    test('plain prose with no markers → empty calls', () => {
        const r = parseMarkers('just a chat reply with no tools');
        expect(r.prose).toBe('just a chat reply with no tools');
        expect(r.calls).toEqual([]);
    });

    test('single ///eval at start of message', () => {
        const r = parseMarkers('///eval\n2 + 2\n');
        expect(r.prose).toBe('');
        expect(r.calls).toEqual([{ kind: 'eval', content: '2 + 2' }]);
    });

    test('prose preamble before marker', () => {
        const r = parseMarkers('Let me check.\n///eval\nawait Bun.file("x").text()');
        expect(r.prose).toBe('Let me check.');
        expect(r.calls[0]).toEqual({ kind: 'eval', content: 'await Bun.file("x").text()' });
    });

    test('///write:<path> captures path and content verbatim', () => {
        const r = parseMarkers('///write:src/foo.ts\nexport default 1;\n');
        expect(r.calls).toEqual([{ kind: 'write', path: 'src/foo.ts', content: 'export default 1;' }]);
    });

    test('content keeps internal newlines and special chars', () => {
        const body = 'export default function () {\n  return `hi ${who}`;\n}';
        const r = parseMarkers(`///write:src/foo.ts\n${body}\n`);
        expect(r.calls[0]).toEqual({ kind: 'write', path: 'src/foo.ts', content: body });
    });

    test('multiple markers run sequentially', () => {
        const text = [
            'ok, doing two things:',
            '///eval',
            'return 1 + 1;',
            '///write:a.ts',
            'export const a = 1;',
        ].join('\n');
        const r = parseMarkers(text);
        expect(r.prose).toBe('ok, doing two things:');
        expect(r.calls).toEqual([
            { kind: 'eval', content: 'return 1 + 1;' },
            { kind: 'write', path: 'a.ts', content: 'export const a = 1;' },
        ]);
    });

    test('lines starting with /// that are NOT eval/write are content, not markers', () => {
        const text = [
            '///write:src/lib.rs',
            '/// doc comment for the module',
            'pub fn x() {}',
        ].join('\n');
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]).toEqual({
            kind: 'write',
            path: 'src/lib.rs',
            content: '/// doc comment for the module\npub fn x() {}',
        });
    });

    test('marker not at start of line is ignored', () => {
        const text = 'see ///eval somewhere mid-line\nmore prose';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.prose).toBe(text);
    });

    test('last marker content extends to end of message (no trailing newline required)', () => {
        const r = parseMarkers('///eval\n42');
        expect(r.calls).toEqual([{ kind: 'eval', content: '42' }]);
    });

    test('preserves blank lines inside content', () => {
        const text = '///eval\nline1\n\nline3\n';
        const r = parseMarkers(text);
        expect(r.calls[0]!.content).toBe('line1\n\nline3');
    });

    test('empty path in ///write: is rejected (treated as content)', () => {
        const r = parseMarkers('///write:\nbody');
        expect(r.calls).toEqual([]);
        expect(r.prose).toBe('///write:\nbody');
    });

    test('eval after write — both parsed', () => {
        const r = parseMarkers('///write:a\nA\n///eval\nreturn 1\n');
        expect(r.calls).toEqual([
            { kind: 'write', path: 'a', content: 'A' },
            { kind: 'eval', content: 'return 1' },
        ]);
    });
});
