// Parse a marker-protocol assistant response. Hardcoded markers:
//   §eval
//   §write:<path>
//   §bash
//   §html
//   §read[:format]   body = file path
//   §grep[:format]   body = query text
//   §edit[:format]   body = edit payload
const EVAL_RE  = /(?<!\\)(?<!`)§eval(?=\n|$)/g;
const WRITE_RE = /(?<!\\)(?<!`)§write:([^\n]+)/g;
const BASH_RE  = /(?<!\\)(?<!`)§bash(?=\n|$)/g;
const HTML_RE  = /(?<!\\)(?<!`)§html(?=\n|$)/g;
const READ_RE  = /(?<!\\)(?<!`)§read(?::([a-z]+))?(?=\n|$)/g;
const GREP_RE  = /(?<!\\)(?<!`)§grep(?::([a-z]+))?(?=\n|$)/g;
const EDIT_RE  = /(?<!\\)(?<!`)§edit(?::([a-z]+))?(?=\n|$)/g;

function unescape(s: string): string {
    return s.replace(/\§/g, '§');
}

const UNESCAPED_RE = /(?<!\\)(?<!`)§\S*/g;

type Candidate = {
    index: number;
    len: number;
    kind: 'eval' | 'write' | 'html' | 'bash' | 'read' | 'grep' | 'edit';
    path?: string;
    format?: 'plain' | 'hashline';
};

export default function (_ctx: Context, opts: { text: string }): {
    prose: string;
    calls: types.agent.MarkerCall[];
    errors: types.agent.MarkerParseError[];
} {
    const { text } = opts;
    const candidates: Candidate[] = [];

    for (const m of text.matchAll(EVAL_RE)) candidates.push({ index: m.index!, len: m[0].length, kind: 'eval' });
    for (const m of text.matchAll(WRITE_RE)) {
        const path = m[1]!.trim();
        if (!path) continue;
        candidates.push({ index: m.index!, len: m[0].length, kind: 'write', path });
    }
    for (const m of text.matchAll(HTML_RE)) candidates.push({ index: m.index!, len: m[0].length, kind: 'html' });
    for (const m of text.matchAll(BASH_RE)) candidates.push({ index: m.index!, len: m[0].length, kind: 'bash' });
    for (const m of text.matchAll(READ_RE)) candidates.push({
        index: m.index!,
        len: m[0].length,
        kind: 'read',
        format: (m[1] as any) === 'hashline' ? 'hashline' : 'plain',
    });
    for (const m of text.matchAll(GREP_RE)) candidates.push({
        index: m.index!,
        len: m[0].length,
        kind: 'grep',
        format: (m[1] as any) === 'hashline' ? 'hashline' : 'plain',
    });
    for (const m of text.matchAll(EDIT_RE)) candidates.push({
        index: m.index!,
        len: m[0].length,
        kind: 'edit',
        format: (m[1] as any) === 'hashline' ? 'hashline' : 'hashline',
    });

    candidates.sort((a, b) => a.index - b.index);

    type Hit = { index: number; consumeLen: number; call: types.agent.MarkerCall };
    const hits: Hit[] = [];

    for (const c of candidates) {
        const after = c.index + c.len;
        const followedByNewline = after >= text.length || text[after] === '\n';
        if (!followedByNewline) continue;

        const atCol1 = c.index === 0 || text[c.index - 1] === '\n';
        if (!atCol1) continue;

        const consumeLen = after < text.length ? c.len + 1 : c.len;
        const call: types.agent.MarkerCall =
            c.kind === 'write' ? { kind: 'write', path: c.path!, content: '' }
            : c.kind === 'html' ? { kind: 'html', content: '' }
            : c.kind === 'bash' ? { kind: 'bash', content: '' }
            : c.kind === 'read' ? { kind: 'read', path: '', format: c.format }
            : c.kind === 'grep' ? { kind: 'grep', content: '', format: c.format }
            : c.kind === 'edit' ? { kind: 'edit', content: '', format: c.format as any }
            : { kind: 'eval', content: '' };
        hits.push({ index: c.index, consumeLen, call });
    }

    const errors: types.agent.MarkerParseError[] = [];
    let proseRaw = '';

    if (hits.length === 0) proseRaw = text;
    else proseRaw = text.slice(0, hits[0]!.index).replace(/\n+$/, '');

    for (const m of proseRaw.matchAll(UNESCAPED_RE)) {
        const snippet = m[0]!.slice(0, 30);
        errors.push({
            kind: 'unescaped',
            position: m.index!,
            hint: `Warning: unescaped '§' at byte ${m.index!} of prose (${JSON.stringify(snippet)}). The '§' character is reserved for marker execution. Either escape it as '\§' if you mean a literal, or place '§eval' / '§write:<path>' / '§bash' / '§html' at column 1 followed by '\\n' to execute. Mid-line or unknown kinds are NOT executed.`,
        });
    }

    if (hits.length === 0) return { prose: unescape(proseRaw), calls: [], errors };

    const prose = unescape(proseRaw);
    const calls: types.agent.MarkerCall[] = [];
    for (let i = 0; i < hits.length; i++) {
        const cur = hits[i]!;
        const next = hits[i + 1];
        const start = cur.index + cur.consumeLen;
        const end = next ? next.index : text.length;
        let raw = text.slice(start, end);
        if (raw.endsWith('\n')) raw = raw.slice(0, -1);

        let content = raw;
        const closeMatch = raw.match(/(?:^|\n)§(?=\n|$)/);
        if (closeMatch) content = raw.slice(0, closeMatch.index);
        content = content.replace(/\n§\s*$/, '');

        if (content.trim() === '') continue;
        const body = unescape(content);
        if (cur.call.kind === 'read') {
            cur.call.path = body.trim();
            if (!cur.call.path) continue;
        } else if (cur.call.kind === 'grep' || cur.call.kind === 'edit') {
            cur.call.content = body;
        } else {
            (cur.call as any).content = body;
        }
        calls.push(cur.call);
    }

    return { prose, calls, errors };
}