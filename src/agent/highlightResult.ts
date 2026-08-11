// Render a tool call's output as syntax-highlighted HTML.
//
// JSON is pretty-printed and highlighted as JSON whatever the tool; otherwise
// the caller says which grammar fits (ctx.fns.agent.toolLang knows: a read of a
// .py file is Python, bash output is plain text). Defaults to text rather than
// JavaScript — colouring prose as code is worse than not colouring it.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { output: string; lang?: string },
): Promise<string> {
    const { output } = opts;
    const trimmed = output.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
            return await ctx.fns.markdown.highlight({ code: pretty, lang: 'json' });
        } catch {}
    }
    return await ctx.fns.markdown.highlight({ code: output, lang: opts.lang || 'text' });
}
