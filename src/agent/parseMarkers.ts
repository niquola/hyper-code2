// Parse a marker-protocol assistant response. Two markers, hardcoded:
//   ///eval            → kind='eval'
//   ///write:<path>    → kind='write', <path> = everything between `:` and end of line
//
// FORMAT (strict):
//   - marker starts at column 1 (preceded by \n or start-of-input)
//   - marker is immediately followed by \n (or end-of-input)
//   - body starts on the next line, runs until next marker or end-of-input
//   - the single trailing newline before the next marker is dropped
//
// PERMISSIVE DETECTION: if a candidate marker is followed by a newline but is
// NOT at column 1 (e.g. `текст.///eval\n...`), it's recorded as a `misplaced`
// error so runMarkers can feed it back to the model. A bare `///eval` mid-line
// without a trailing newline (like the words "see ///eval somewhere") is just
// content and is not flagged.
//
// Lines starting with `///` that are NOT exactly `///eval` or `///write:<path>`
// followed by `\n` are content (e.g. Rust `/// doc` comments inside a write body).
const EVAL_RE  = /\/\/\/eval(?=\n|$)/g;
const WRITE_RE = /\/\/\/write:([^\n]+)/g;

type Candidate = {
    index: number;
    len: number;
    kind: 'eval' | 'write';
    path?: string;
};

export default function (text: string): {
    prose: string;
    calls: types.agent.MarkerCall[];
    errors: types.agent.MarkerParseError[];
} {
    const candidates: Candidate[] = [];

    for (const m of text.matchAll(EVAL_RE)) {
        candidates.push({ index: m.index!, len: m[0].length, kind: 'eval' });
    }
    for (const m of text.matchAll(WRITE_RE)) {
        const path = m[1]!.trim();
        if (!path) continue;
        candidates.push({ index: m.index!, len: m[0].length, kind: 'write', path });
    }
    candidates.sort((a, b) => a.index - b.index);

    type Hit = { index: number; consumeLen: number; call: types.agent.MarkerCall };
    const hits: Hit[] = [];
    const errors: types.agent.MarkerParseError[] = [];

    for (const c of candidates) {
        const after = c.index + c.len;
        const followedByNewline = after >= text.length || text[after] === '\n';
        // EVAL_RE has a lookahead that already requires this. WRITE_RE doesn't.
        if (!followedByNewline) continue;

        const atCol1 = c.index === 0 || text[c.index - 1] === '\n';

        if (atCol1) {
            // Valid marker. Consume marker + the trailing \n (if not at EOF) so
            // the body slice starts on the body's own line.
            const consumeLen = after < text.length ? c.len + 1 : c.len;
            const call: types.agent.MarkerCall = c.kind === 'write'
                ? { kind: 'write', path: c.path!, content: '' }
                : { kind: 'eval', content: '' };
            hits.push({ index: c.index, consumeLen, call });
        } else {
            // Almost-marker: looks like a marker (followed by \n) but glued to
            // preceding text. Almost certainly the model forgot the leading \n.
            const prevChar = text[c.index - 1]!;
            const markerStr = c.kind === 'write' ? `///write:${c.path}` : '///eval';
            errors.push({
                kind: 'misplaced',
                marker: c.kind,
                position: c.index,
                hint: `Found '${markerStr}' at byte ${c.index} but the preceding character is ${JSON.stringify(prevChar)}, not '\\n'. Markers must start at column 1 — put a newline directly before '///'. Re-emit the failed call with the marker on its own line.`,
            });
        }
    }

    if (hits.length === 0) {
        return { prose: text, calls: [], errors };
    }

    const first = hits[0]!;
    const prose = text.slice(0, first.index).replace(/\n+$/, '');

    const calls: types.agent.MarkerCall[] = [];
    for (let i = 0; i < hits.length; i++) {
        const cur = hits[i]!;
        const next = hits[i + 1];
        const start = cur.index + cur.consumeLen;
        const end = next ? next.index : text.length;
        let content = text.slice(start, end);
        if (content.endsWith('\n')) content = content.slice(0, -1);
        cur.call.content = content;
        calls.push(cur.call);
    }

    return { prose, calls, errors };
}
