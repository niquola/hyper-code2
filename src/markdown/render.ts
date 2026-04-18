const ENTITIES: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&#x27;": "'",
};
function decode(s: string): string {
    return s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

export default async function (ctx: Context, text: string): Promise<string> {
    let html = Bun.markdown.html(text);
    const re = /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g;
    const replacements: Array<{ full: string; pretty: string }> = [];
    for (const m of html.matchAll(re)) {
        const [full, lang, raw] = m;
        const pretty = await ctx.fns.markdown.highlight(ctx, decode(raw!), lang!);
        replacements.push({ full: full!, pretty });
    }
    for (const { full, pretty } of replacements) html = html.replace(full, pretty);
    return html;
}
