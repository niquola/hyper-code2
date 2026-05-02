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

    test('marker mid-line without trailing newline is content (not flagged)', () => {
        // "see ///eval somewhere" — looks like a casual mention, no \n right
        // after `///eval`, so no candidate. Whole text stays as prose.
        const text = 'see ///eval somewhere mid-line\nmore prose';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toBe(text);
    });

    test('almost-marker (missing \\n before ///eval) is executed and a warning is attached', () => {
        // Live bug pattern: model writes `prose.///eval\nbody`. We execute it
        // anyway (so the turn isn't wasted) but emit a warning so it fixes the
        // format on the next turn.
        const text = 'считаю.///eval\nlet n = 10; console.log(n);';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]).toMatchObject({ kind: 'eval' });
        expect(r.calls[0]!.content).toBe('let n = 10; console.log(n);');
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('misplaced');
        expect(r.errors[0]!.marker).toBe('eval');
        expect(r.errors[0]!.hint).toContain('Warning');
        expect(r.errors[0]!.hint).toContain('executed anyway');
    });

    test('almost-marker for ///write is also executed with a warning', () => {
        const text = 'lemme write a file.///write:foo.ts\nexport default 1;';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]).toMatchObject({ kind: 'write', path: 'foo.ts' });
        expect(r.calls[0]!.content).toBe('export default 1;');
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.marker).toBe('write');
    });

    test('mixed: one valid eval and one misplaced — both run, only the misplaced one warns', () => {
        const text = 'first one is good:\n///eval\nconsole.log(1);\nthen.///eval\nconsole.log(2);';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(2);
        // First eval body extends until the second marker's start byte. With
        // the misplaced `then.` glued in, that prose lands inside the body.
        // (The model gets a warning anyway, so it'll fix this on the next turn.)
        expect(r.calls[0]!.content).toContain('console.log(1);');
        expect(r.calls[1]!.content).toBe('console.log(2);');
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.marker).toBe('eval');
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

    test('Haiku quirk: trailing closing fence `\\n///` is stripped from body', () => {
        // Haiku adds a `///` closing fence at the end of eval bodies, mimicking
        // ``` style. Without normalization this becomes garbage inside the body.
        const text = '///eval\nconsole.log(2 + 2)\n///\n';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.content).toBe('console.log(2 + 2)');
    });

    test('Haiku quirk: trailing empty marker (hallucinated next call) is dropped', () => {
        // Haiku sometimes emits a second `///eval` with empty body on the same
        // turn, before tool results have come back. Treat these as fabricated.
        const text = '///eval\nconsole.log(1);\n///eval\n';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.content).toBe('console.log(1);');
    });

    test('Haiku quirk: empty trailing write marker is dropped', () => {
        const text = '///write:a.ts\nexport const a = 1;\n///write:b.ts\n';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]).toEqual({ kind: 'write', path: 'a.ts', content: 'export const a = 1;' });
    });

    test('escape: ////eval in prose is content, unescaped to ///eval', () => {
        const text = 'Можно писать ////eval в тексте — это буквальный маркер.\n////eval\nlet x = 1;';
        const r = parseMarkers(text);
        // No real markers — both ////eval lines are escaped.
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        // After unescape, prose shows ///eval as the user intended.
        expect(r.prose).toContain('///eval в тексте');
        expect(r.prose).toContain('\n///eval\nlet x = 1;');
    });

    test('escape: ////write: in prose is content, unescaped to ///write:', () => {
        const text = 'Маркер записи: ////write:src/foo.ts\nbody';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toContain('///write:src/foo.ts');
    });

    test('escape: ////marker INSIDE a real eval body becomes ///marker for the runtime', () => {
        // The model wants to eval a string containing `///eval`. It escapes
        // the literal in its body with four slashes; the parser unescapes
        // back to three so the executed code sees the intended string.
        const text = '///eval\nconst s = "////eval is the escape";\nconsole.log(s);';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.content).toContain('///eval is the escape');
    });

    test('escape: real ///eval still works alongside escaped ////eval', () => {
        const text = '////eval\nthis line is escaped\n///eval\nconsole.log(1);';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.content).toBe('console.log(1);');
        // The escaped line lives in prose with three slashes after unescape.
        expect(r.prose).toBe('///eval\nthis line is escaped');
    });

    test('///html marker captures raw HTML body', () => {
        const text = '///html\n<div class="card"><b>Hi</b></div>';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'html', content: '<div class="card"><b>Hi</b></div>' }]);
    });

    test('///html with backticks/quotes survives untouched', () => {
        const body = '<script>const x = `${name}`; alert("hi");</script>';
        const r = parseMarkers(`///html\n${body}`);
        expect(r.calls[0]).toEqual({ kind: 'html', content: body });
    });

    test('html mid-line missing-newline is executed with a warning', () => {
        const text = 'смотри.///html\n<b>x</b>';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]).toMatchObject({ kind: 'html' });
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.marker).toBe('html');
    });

    test('escape: ////html is content not a marker', () => {
        const text = 'У нас есть маркер ////html для рендера HTML.';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toContain('///html');
    });

    test('///bash captures shell body', () => {
        const r = parseMarkers('///bash\nls -la\ngit status\n');
        expect(r.calls).toEqual([{ kind: 'bash', content: 'ls -la\ngit status' }]);
    });

    test('escape: ////bash is content not a marker', () => {
        const r = parseMarkers('запусти ////bash для команд.');
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toContain('///bash');
    });

    test('mixed eval + bash + write in one turn', () => {
        const r = parseMarkers([
            '///eval',
            'console.log(1);',
            '///bash',
            'ls',
            '///write:foo.ts',
            'export default 1;',
        ].join('\n'));
        expect(r.calls.map((c: any) => c.kind)).toEqual(['eval', 'bash', 'write']);
        expect(r.calls[1]).toEqual({ kind: 'bash', content: 'ls' });
    });

    test('eval after write — both parsed', () => {
        const r = parseMarkers('///write:a\nA\n///eval\nreturn 1\n');
        expect(r.calls).toEqual([
            { kind: 'write', path: 'a', content: 'A' },
            { kind: 'eval', content: 'return 1' },
        ]);
    });
});
