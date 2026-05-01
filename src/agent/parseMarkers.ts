// Parse a marker-protocol assistant response. Two markers, hardcoded:
//   ///eval            → kind='eval'
//   ///write:<path>    → kind='write', <path> = everything between `:` and end of line
//
// STRICT format: marker is followed by a newline. Body starts on the NEXT line
// and runs until the next marker (or end of message). The single trailing newline
// before the next marker is dropped.
//
// Lines starting with `///` that are NOT exactly `///eval` or `///write:<path>`
// at the start of a line followed by `\n` are content (e.g. Rust `/// doc`
// comments inside a write body, or stray `///foo` chatter).
const EVAL_RE  = /^\/\/\/eval\n/gm;
const WRITE_RE = /^\/\/\/write:([^\n]+)\n/gm;

export default function (text: string): {
    prose: string;
    calls: types.agent.MarkerCall[];
} {
    type Hit = { index: number; len: number; call: types.agent.MarkerCall };
    const hits: Hit[] = [];

    for (const m of text.matchAll(EVAL_RE)) {
        hits.push({ index: m.index!, len: m[0].length, call: { kind: 'eval', content: '' } });
    }
    for (const m of text.matchAll(WRITE_RE)) {
        const path = m[1]!.trim();
        if (!path) continue;
        hits.push({ index: m.index!, len: m[0].length, call: { kind: 'write', path, content: '' } });
    }
    hits.sort((a, b) => a.index - b.index);

    if (hits.length === 0) return { prose: text, calls: [] };

    const first = hits[0]!;
    const prose = text.slice(0, first.index).replace(/\n+$/, '');

    const calls: types.agent.MarkerCall[] = [];
    for (let i = 0; i < hits.length; i++) {
        const cur = hits[i]!;
        const next = hits[i + 1];
        const start = cur.index + cur.len;
        const end = next ? next.index : text.length;
        let content = text.slice(start, end);
        if (content.endsWith('\n')) content = content.slice(0, -1);
        calls.push({ ...cur.call, content });
    }

    return { prose, calls };
}
