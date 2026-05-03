// Render a marker call's stdout/return value as syntax-highlighted HTML.
// JSON output is pretty-printed and highlighted as `json`; everything else
// falls back to `javascript` (loose enough for repl return values, error
// stacks, plain text — Shiki will tolerate them).
export default async function (ctx: Context, opts: { output: string }): Promise<string> {
    const { output } = opts;
    const trimmed = output.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
            return await ctx.fns.markdown.highlight(ctx, { code: pretty, lang: 'json' });
        } catch {}
    }
    return await ctx.fns.markdown.highlight(ctx, { code: output, lang: 'javascript' });
}
