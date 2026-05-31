import { describe, test, expect } from 'bun:test';
import parseMarkersFn from './parseMarkers';
const parseMarkers = (text: string) => parseMarkersFn(null as any, { text });

describe('agent.parseMarkers', () => {
    test('plain prose with no markers → empty calls', () => {
        const r = parseMarkers('just a chat reply with no tools');
        expect(r.prose).toBe('just a chat reply with no tools');
        expect(r.calls).toEqual([]);
    });

    test('single §eval at start of message', () => {
        const r = parseMarkers('§eval\n2 + 2\n');
        expect(r.prose).toBe('');
        expect(r.calls).toEqual([{ kind: 'eval', content: '2 + 2' }]);
    });

    test('prose preamble before marker', () => {
        const r = parseMarkers('Let me check.\n§eval\nawait Bun.file("x").text()');
        expect(r.prose).toBe('Let me check.');
        expect(r.calls[0]).toEqual({ kind: 'eval', content: 'await Bun.file("x").text()' });
    });

    test('§write:<path> captures path and content verbatim', () => {
        const r = parseMarkers('§write:src/foo.ts\nexport default 1;\n');
        expect(r.calls).toEqual([{ kind: 'write', path: 'src/foo.ts', content: 'export default 1;' }]);
    });

    test('§read plain captures body as path', () => {
        const r = parseMarkers('§read\nsrc/foo.ts\n');
        expect(r.calls).toEqual([{ kind: 'read', path: 'src/foo.ts', format: 'plain' }]);
    });

    test('§read:hashline captures body as path', () => {
        const r = parseMarkers('§read:hashline\nsrc/foo.ts\n');
        expect(r.calls).toEqual([{ kind: 'read', path: 'src/foo.ts', format: 'hashline' }]);
    });

    test('§grep plain captures body', () => {
        const r = parseMarkers('§grep\npattern: foo\npath: src\n');
        expect(r.calls).toEqual([{ kind: 'grep', format: 'plain', content: 'pattern: foo\npath: src' }]);
    });

    test('§grep:hashline captures body', () => {
        const r = parseMarkers('§grep:hashline\npattern: foo\n');
        expect(r.calls).toEqual([{ kind: 'grep', format: 'hashline', content: 'pattern: foo' }]);
    });

    test('§edit captures body', () => {
        const r = parseMarkers('§edit\n@a.ts\n= 1aa\n|x\n');
        expect(r.calls).toEqual([{ kind: 'edit', content: '@a.ts\n= 1aa\n|x', format: 'hashline' }]);
    });

    test('§edit:hashline captures body', () => {
        const r = parseMarkers('§edit:hashline\n@a.ts\n= 1aa\n|x\n');
        expect(r.calls).toEqual([{ kind: 'edit', content: '@a.ts\n= 1aa\n|x', format: 'hashline' }]);
    });

    test('content keeps internal newlines and special chars', () => {
        const body = 'export default function () {\n  return `hi ${who}`;\n}';
        const r = parseMarkers(`§write:src/foo.ts\n${body}\n`);
        expect(r.calls[0]).toEqual({ kind: 'write', path: 'src/foo.ts', content: body });
    });

    test('multiple markers run sequentially', () => {
        const text = [
            'ok, doing two things:',
            '§eval',
            'return 1 + 1;',
            '§write:a.ts',
            'export const a = 1;',
        ].join('\n');
        const r = parseMarkers(text);
        expect(r.prose).toBe('ok, doing two things:');
        expect(r.calls).toEqual([
            { kind: 'eval', content: 'return 1 + 1;' },
            { kind: 'write', path: 'a.ts', content: 'export const a = 1;' },
        ]);
    });

    test('mid-line marker without trailing newline is content + warns about unescaped §', () => {
        const text = 'see §eval somewhere mid-line\nmore prose';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('unescaped');
        expect(r.errors[0]!.hint).toContain('§eval');
        expect(r.prose).toBe(text);
    });

    test('marker not at column 1 is content + warns', () => {
        const text = 'считаю.§eval\nlet n = 10; console.log(n);';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('unescaped');
        expect(r.prose).toBe(text);
    });

    test('§write glued to preceding text without \\n is content + warns', () => {
        const text = 'lemme write a file.§write:foo.ts\nexport default 1;';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('unescaped');
    });

    test('mixed: well-placed marker runs; misplaced § stays in body (no warning since prose is empty)', () => {
        const text = 'first one is good:\n§eval\nconsole.log(1);\nthen.§eval\nconsole.log(2);';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect((r.calls[0] as any).content).toContain('console.log(1);');
        expect((r.calls[0] as any).content).toContain('then.§eval');
        expect(r.errors).toEqual([]);
    });

    test('stray bare § in prose triggers warning', () => {
        const text = 'просто § символ в тексте';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('unescaped');
    });

    test('backtick escape: `§eval` in prose is content, no warning, backticks preserved', () => {
        const text = 'See `§eval` for details.';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toBe('See `§eval` for details.');
    });

    test('last marker content extends to end of message (no trailing newline required)', () => {
        const r = parseMarkers('§eval\n42');
        expect(r.calls).toEqual([{ kind: 'eval', content: '42' }]);
    });

    test('preserves blank lines inside content', () => {
        const text = '§eval\nline1\n\nline3\n';
        const r = parseMarkers(text);
        expect((r.calls[0] as any).content).toBe('line1\n\nline3');
    });

    test('empty path in §write: is rejected (treated as content)', () => {
        const r = parseMarkers('§write:\nbody');
        expect(r.calls).toEqual([]);
        expect(r.prose).toBe('§write:\nbody');
    });

    test('Haiku quirk: trailing closing fence `\\n§` is stripped from body', () => {
        const text = '§eval\nconsole.log(2 + 2)\n§\n';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect((r.calls[0] as any).content).toBe('console.log(2 + 2)');
    });

    test('explicit closing § terminates body early; content after close is dropped', () => {
        const text = '§eval\nline1\n§\ndropped tail';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'eval', content: 'line1' }]);
    });

    test('§html marker captures raw HTML body', () => {
        const text = '§html\n<div class="card"><b>Hi</b></div>';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'html', content: '<div class="card"><b>Hi</b></div>' }]);
    });

    test('§bash captures shell body', () => {
        const r = parseMarkers('§bash\nls -la\ngit status\n');
        expect(r.calls).toEqual([{ kind: 'bash', content: 'ls -la\ngit status' }]);
    });
});