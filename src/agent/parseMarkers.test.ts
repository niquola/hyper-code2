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
        // "see §eval somewhere" — casual mention, no \n right after `§eval`,
        // so no candidate. Whole text stays as prose, but the unescaped `§`
        // surfaces as a warning so the model self-corrects.
        const text = 'see §eval somewhere mid-line\nmore prose';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('unescaped');
        expect(r.errors[0]!.hint).toContain('§eval');
        expect(r.prose).toBe(text);
    });

    test('marker not at column 1 is content + warns', () => {
        // Live bug pattern: model writes `prose.§eval\nbody`. Strict: this
        // is content. The unescaped-§ warning tells the model to either
        // escape (`\§eval`) or move the marker to column 1.
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
        // The misplaced `then.§eval\nconsole.log(2);` is captured into the
        // first marker's body. Body content is not scanned for unescaped §
        // (could be legitimate code/text), so no warning here.
        expect(r.calls[0]!.content).toContain('console.log(1);');
        expect(r.calls[0]!.content).toContain('then.§eval');
        expect(r.errors).toEqual([]);
    });

    test('stray bare § in prose triggers warning', () => {
        const text = 'просто § символ в тексте';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('unescaped');
    });

    test('escaped \\§ does NOT trigger warning', () => {
        const text = 'literal \\§ in text and \\§eval mention';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toBe('literal § in text and §eval mention');
    });

    test('backtick escape: `§eval` in prose is content, no warning, backticks preserved', () => {
        const text = 'See `§eval` for details.';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toBe('See `§eval` for details.');
    });

    test('backtick escape: lone `§` no warning', () => {
        const text = 'the `§` symbol';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toBe('the `§` symbol');
    });

    test('backtick escape works for all marker kinds', () => {
        const text = 'use `§bash`, `§eval`, `§write:`, `§html` markers';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toContain('`§bash`');
    });

    test('last marker content extends to end of message (no trailing newline required)', () => {
        const r = parseMarkers('§eval\n42');
        expect(r.calls).toEqual([{ kind: 'eval', content: '42' }]);
    });

    test('preserves blank lines inside content', () => {
        const text = '§eval\nline1\n\nline3\n';
        const r = parseMarkers(text);
        expect(r.calls[0]!.content).toBe('line1\n\nline3');
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
        expect(r.calls[0]!.content).toBe('console.log(2 + 2)');
    });

    test('explicit closing § terminates body early; content after close is dropped', () => {
        const text = '§eval\nline1\n§\ndropped tail';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'eval', content: 'line1' }]);
    });

    test('explicit closing § followed by another marker', () => {
        const text = '§eval\nline1\n§\n§eval\nline2';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([
            { kind: 'eval', content: 'line1' },
            { kind: 'eval', content: 'line2' },
        ]);
    });

    test('closing § as the very first line of body = empty body, dropped', () => {
        const text = '§eval\n§\nline\n§eval\nbody';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'eval', content: 'body' }]);
    });

    test('escaped \\§ inside body is content, not a close', () => {
        const text = '§eval\nline1\n\\§\nline2';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        // \§ is not a close (parser skips it). After unescape, body shows §.
        expect(r.calls[0]!.content).toBe('line1\n§\nline2');
    });

    test('§ in middle of line is body content, not a close', () => {
        const text = '§eval\nconst s = "§ symbol";';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'eval', content: 'const s = "§ symbol";' }]);
    });

    test('explicit close in §write body', () => {
        const text = '§write:src/x.ts\nexport default 1;\n§\nfollow-up prose';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'write', path: 'src/x.ts', content: 'export default 1;' }]);
    });

    test('Haiku quirk: trailing empty marker (hallucinated next call) is dropped', () => {
        const text = '§eval\nconsole.log(1);\n§eval\n';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.content).toBe('console.log(1);');
    });

    test('Haiku quirk: empty trailing write marker is dropped', () => {
        const text = '§write:a.ts\nexport const a = 1;\n§write:b.ts\n';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]).toEqual({ kind: 'write', path: 'a.ts', content: 'export const a = 1;' });
    });

    test('escape: \\§eval in prose is content, unescaped to §eval', () => {
        const text = 'Можно писать \\§eval в тексте — это буквальный маркер.\n\\§eval\nlet x = 1;';
        const r = parseMarkers(text);
        // No real markers — both \§eval lines are escaped.
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        // After unescape, prose shows §eval as the user intended.
        expect(r.prose).toContain('§eval в тексте');
        expect(r.prose).toContain('\n§eval\nlet x = 1;');
    });

    test('escape: \\§write: in prose is content, unescaped to §write:', () => {
        const text = 'Маркер записи: \\§write:src/foo.ts\nbody';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toContain('§write:src/foo.ts');
    });

    test('escape: \\§marker INSIDE a real eval body becomes §marker for the runtime', () => {
        // The model wants to eval a string containing `§eval`. It escapes
        // the literal in its body with `\§`; the parser unescapes back to
        // bare `§` so the executed code sees the intended string.
        const text = '§eval\nconst s = "\\§eval is the escape";\nconsole.log(s);';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.content).toContain('§eval is the escape');
    });

    test('escape: real §eval still works alongside escaped \\§eval', () => {
        const text = '\\§eval\nthis line is escaped\n§eval\nconsole.log(1);';
        const r = parseMarkers(text);
        expect(r.calls).toHaveLength(1);
        expect(r.calls[0]!.content).toBe('console.log(1);');
        // The escaped line lives in prose with bare § after unescape.
        expect(r.prose).toBe('§eval\nthis line is escaped');
    });

    test('§html marker captures raw HTML body', () => {
        const text = '§html\n<div class="card"><b>Hi</b></div>';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([{ kind: 'html', content: '<div class="card"><b>Hi</b></div>' }]);
    });

    test('§html with backticks/quotes survives untouched', () => {
        const body = '<script>const x = `${name}`; alert("hi");</script>';
        const r = parseMarkers(`§html\n${body}`);
        expect(r.calls[0]).toEqual({ kind: 'html', content: body });
    });

    test('html mid-line missing-newline is content (strict) + warns', () => {
        const text = 'смотри.§html\n<b>x</b>';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]!.kind).toBe('unescaped');
        expect(r.prose).toBe(text);
    });

    test('escape: \\§html is content not a marker', () => {
        const text = 'У нас есть маркер \\§html для рендера HTML.';
        const r = parseMarkers(text);
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toContain('§html');
    });

    test('§bash captures shell body', () => {
        const r = parseMarkers('§bash\nls -la\ngit status\n');
        expect(r.calls).toEqual([{ kind: 'bash', content: 'ls -la\ngit status' }]);
    });

    test('escape: \\§bash is content not a marker', () => {
        const r = parseMarkers('запусти \\§bash для команд.');
        expect(r.calls).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.prose).toContain('§bash');
    });

    test('mixed eval + bash + write in one turn', () => {
        const r = parseMarkers([
            '§eval',
            'console.log(1);',
            '§bash',
            'ls',
            '§write:foo.ts',
            'export default 1;',
        ].join('\n'));
        expect(r.calls.map((c: any) => c.kind)).toEqual(['eval', 'bash', 'write']);
        expect(r.calls[1]).toEqual({ kind: 'bash', content: 'ls' });
    });

    test('eval after write — both parsed', () => {
        const r = parseMarkers('§write:a\nA\n§eval\nreturn 1\n');
        expect(r.calls).toEqual([
            { kind: 'write', path: 'a', content: 'A' },
            { kind: 'eval', content: 'return 1' },
        ]);
    });
});
