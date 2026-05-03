const ENTITIES: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&#x27;": "'",
};
function decode(s: string): string {
    return s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

async function preprocessMermaid(ctx: Context, text: string): Promise<string> {
    const re = /```mermaid[^\n]*\n([\s\S]*?)```/g;
    const matches = [...text.matchAll(re)];
    if (matches.length === 0) return text;
    let out = text;
    for (const m of matches.reverse()) {
        const code = m[1]?.trim() ?? "";
        try {
            const html = await ctx.fns.markdown.mermaid(ctx, { source: code });
            out = out.slice(0, m.index!) + html + out.slice(m.index! + m[0]!.length);
        } catch {
            continue;
        }
    }
    return out;
}

export default async function (ctx: Context, opts: { source: string }): Promise<string> {
    let source = opts.source;
    if (source.includes("```mermaid")) source = await preprocessMermaid(ctx, source);
    let html = Bun.markdown.html(source);
    const re = /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g;
    const replacements: Array<{ full: string; pretty: string }> = [];
    for (const m of html.matchAll(re)) {
        const [full, lang, raw] = m;
        const pretty = await ctx.fns.markdown.highlight(ctx, { code: decode(raw!), lang: lang! });
        replacements.push({ full: full!, pretty });
    }
    for (const { full, pretty } of replacements) html = html.replace(full, pretty);
    return html;
}
