// Format a TSX render/parse error for the synthetic §error:html feedback.
// Includes Bun.Transpiler's `position` (line/col + offending source line) when
// available, then a truncated body preview so the model can correlate.
export default function (e: any, body: string): string {
    const msg = (e?.message ?? String(e)) || 'unknown error';
    const pos = e?.position;
    const detail = pos
        ? `${msg}\nat line ${pos.line}, col ${pos.column}: ${String(pos.lineText ?? '').trim()}`
        : msg;
    const preview = body.length > 800
        ? body.slice(0, 800) + `\n…(+${body.length - 800} chars)`
        : body;
    return `${detail}\n\nbody:\n${preview}`;
}
