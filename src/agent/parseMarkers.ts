// Parse a marker-protocol assistant response. Four markers, hardcoded:
//   §eval            → kind='eval'  (run JS, body is code, has a result)
//   §write:<path>    → kind='write' (write file, <path> after `:` to EOL)
//   §bash            → kind='bash'  (run shell via `bash -c`, has a result)
//   §html            → kind='html'  (raw HTML rendered straight to the chat
//                                    bubble; no execution, no result feedback)
// FORMAT (strict, no exceptions):
//   - marker MUST be at column 1 (start of input or right after \n)
//   - marker MUST be followed by \n (or end-of-input)
//   - body starts on the next line, runs until next marker or end-of-input
//   - the single trailing newline before the next marker is dropped
//
// MISPLACED MARKERS ARE NOT EXECUTED. A `§eval` glued to preceding text
// (no leading \n) is content; the model gets a warning telling it to either
// escape with `\§eval` or put the marker at column 1.
//
// ESCAPE — two forms, both make the parser skip the §:
//
//   \§...   backslash escape. After parsing, `\§` is collapsed back to
//           bare `§` for display via unescape().
//
//   `§...   backtick escape. Inline-code style — the backtick is part of
//           the prose (typical markdown code span: `§eval`), so it is
//           preserved verbatim, NOT collapsed.
//
// UNESCAPED `§` IN PROSE: any `§` outside a marker body that is preceded
// by neither `\` nor `` ` `` AND isn't a valid marker triggers an
// 'unescaped' warning. The agent must either escape it (`\§` or
// `` `§ ``) or use the marker form properly. We don't try to guess intent.
const EVAL_RE  = /(?<!\\)(?<!`)§eval(?=\n|$)/g;
const WRITE_RE = /(?<!\\)(?<!`)§write:([^\n]+)/g;
const BASH_RE  = /(?<!\\)(?<!`)§bash(?=\n|$)/g;
const HTML_RE  = /(?<!\\)(?<!`)§html(?=\n|$)/g;

// Reverse the backslash escape: `\§` → `§` everywhere. Applied AFTER
// warning scan so that originally-escaped `\§` doesn't trigger one.
// Backtick-escaped `` `§ `` is left untouched (backticks belong to prose).
function unescape(s: string): string {
    return s.replace(/\\§/g, '§');
}

// Match any unescaped `§` plus its trailing non-whitespace, for diagnostics.
// Skips both `\§` and `` `§ `` — those are the two valid escape forms.
const UNESCAPED_RE = /(?<!\\)(?<!`)§\S*/g;

type Candidate = {
    index: number;
    len: number;
    kind: 'eval' | 'write' | 'html' | 'bash';
    path?: string;
};

export default function (_ctx: Context, opts: { text: string }): {
    prose: string;
    calls: types.agent.MarkerCall[];
    errors: types.agent.MarkerParseError[];
} {
    const { text } = opts;
    const candidates: Candidate[] = [];

    for (const m of text.matchAll(EVAL_RE)) {
        candidates.push({ index: m.index!, len: m[0].length, kind: 'eval' });
    }
    for (const m of text.matchAll(WRITE_RE)) {
        const path = m[1]!.trim();
        if (!path) continue;
        candidates.push({ index: m.index!, len: m[0].length, kind: 'write', path });
    }
    for (const m of text.matchAll(HTML_RE)) {
        candidates.push({ index: m.index!, len: m[0].length, kind: 'html' });
    }
    for (const m of text.matchAll(BASH_RE)) {
        candidates.push({ index: m.index!, len: m[0].length, kind: 'bash' });
    }
    candidates.sort((a, b) => a.index - b.index);

    type Hit = { index: number; consumeLen: number; call: types.agent.MarkerCall };
    const hits: Hit[] = [];

    for (const c of candidates) {
        const after = c.index + c.len;
        const followedByNewline = after >= text.length || text[after] === '\n';
        if (!followedByNewline) continue;

        const atCol1 = c.index === 0 || text[c.index - 1] === '\n';
        // STRICT: a marker not at column 1 is just content. We surface it
        // through the unescaped-§ warning below (whichever § occurrence
        // we picked up via UNESCAPED_RE inside prose).
        if (!atCol1) continue;

        const consumeLen = after < text.length ? c.len + 1 : c.len;
        const call: types.agent.MarkerCall = c.kind === 'write'
            ? { kind: 'write', path: c.path!, content: '' }
            : c.kind === 'html' ? { kind: 'html', content: '' }
            : c.kind === 'bash' ? { kind: 'bash', content: '' }
            : { kind: 'eval', content: '' };
        hits.push({ index: c.index, consumeLen, call });
    }

    // Carve up calls + raw prose. We compute prose BEFORE unescape so the
    // warning scan sees the original `\§` (which it must NOT flag).
    const errors: types.agent.MarkerParseError[] = [];
    let proseRaw = '';

    if (hits.length === 0) {
        proseRaw = text;
    } else {
        const first = hits[0]!;
        proseRaw = text.slice(0, first.index).replace(/\n+$/, '');
    }

    // Scan raw prose for unescaped `§` occurrences and warn.
    for (const m of proseRaw.matchAll(UNESCAPED_RE)) {
        const snippet = m[0]!.slice(0, 30);
        errors.push({
            kind: 'unescaped',
            position: m.index!,
            hint: `Warning: unescaped '§' at byte ${m.index!} of prose (${JSON.stringify(snippet)}). The '§' character is reserved for marker execution. Either escape it as '\\§' if you mean a literal, or place '§eval' / '§write:<path>' / '§bash' / '§html' at column 1 followed by '\\n' to execute. Mid-line or unknown kinds are NOT executed.`,
        });
    }

    if (hits.length === 0) {
        return { prose: unescape(proseRaw), calls: [], errors };
    }

    const prose = unescape(proseRaw);
    const calls: types.agent.MarkerCall[] = [];
    for (let i = 0; i < hits.length; i++) {
        const cur = hits[i]!;
        const next = hits[i + 1];
        const start = cur.index + cur.consumeLen;
        const end = next ? next.index : text.length;
        let raw = text.slice(start, end);
        if (raw.endsWith('\n')) raw = raw.slice(0, -1);

        // Optional explicit close: a bare `§` on its own line ends the body
        // early. After the close, anything up to the next marker (or EOF)
        // is dropped. The body therefore terminates at one of:
        //   1. the start of the next marker
        //   2. end of message
        //   3. a bare `§` line (this branch)
        // Escaped `\§` is NOT a close (the regex requires \n or ^ right
        // before `§`; `\` immediately before fails).
        let content = raw;
        const closeMatch = raw.match(/(?:^|\n)§(?=\n|$)/);
        if (closeMatch) {
            content = raw.slice(0, closeMatch.index);
        }
        // Belt-and-braces: legacy trailing `\n§…` fence at end of body.
        content = content.replace(/\n§\s*$/, '');

        // Drop empty/whitespace-only bodies. Haiku frequently fabricates a
        // trailing `§eval` with empty body before tool results have arrived.
        if (content.trim() === '') continue;
        cur.call.content = unescape(content);
        calls.push(cur.call);
    }

    return { prose, calls, errors };
}
