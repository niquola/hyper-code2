const ENTITIES: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&#x27;": "'",
};
function decode(s: string): string {
    return s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

function escapeHtml(value: unknown): string {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function frontmatterTable(source: string): { source: string; html: string } | null {
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    if (!match) return null;
    try {
        const data = Bun.YAML.parse(match[1]!) as Record<string, unknown>;
        if (!data || Array.isArray(data) || typeof data !== "object") return null;
        const rows = Object.entries(data).map(([key, value]) => {
            const shown = typeof value === "string" ? value : Bun.YAML.stringify(value).trim();
            return `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(shown)}</td></tr>`;
        }).join("");
        const html = rows ? `<div class="md-frontmatter"><table><tbody>${rows}</tbody></table></div>` : "";
        return { source: source.slice(match[0].length), html };
    } catch {
        return null;
    }
}


async function preprocessMermaid(ctx: Context, text: string): Promise<string> {
    const re = /```mermaid[^\n]*\n([\s\S]*?)```/g;
    const matches = [...text.matchAll(re)];
    if (matches.length === 0) return text;
    let out = text;
    for (const m of matches.reverse()) {
        const code = m[1]?.trim() ?? "";
        try {
            const html = await ctx.fns.markdown.mermaid({ source: code });
            out = out.slice(0, m.index!) + html + out.slice(m.index! + m[0]!.length);
        } catch {
            continue;
        }
    }
    return out;
}

/**
 * Renders Markdown to sanitized, highlighted HTML.
 * @param opts.source Markdown or Mermaid source.
 */
export default async function (ctx: Context, _session: Session | null, opts: { source: string }): Promise<string> {
    let source = opts.source;
    const frontmatter = frontmatterTable(source);
    if (frontmatter) source = frontmatter.source;
    if (source.includes("```mermaid")) source = await preprocessMermaid(ctx, source);
    let html = Bun.markdown.html(source);
    const re = /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g;
    const replacements: Array<{ full: string; pretty: string }> = [];
    for (const m of html.matchAll(re)) {
        const [full, lang, raw] = m;
        const pretty = await ctx.fns.markdown.highlight({ code: decode(raw!), lang: lang! });
        replacements.push({ full: full!, pretty });
    }
    for (const { full, pretty } of replacements) html = html.replace(full, pretty);
    return (frontmatter?.html ?? "") + html;
}
