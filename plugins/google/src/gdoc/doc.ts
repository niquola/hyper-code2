// Read a Google Doc's content as plain text and Markdown.
// Accepts a bare doc id or any docs.google.com URL.
// ctx.fns.gdoc.doc({ id: "1Bxi...Ms" })
// → { id, title, text, markdown }
export default async function (ctx: Context, session: Session | null, opts: { id: string; account?: string }) {
    const id = extractId(opts.id);
    const doc = await ctx.fns.gdoc.api({ url: `https://docs.googleapis.com/v1/documents/${id}`, account: opts?.account });
    const content = doc.body?.content || [];
    return {
        id,
        title: doc.title,
        text: render(content, false),
        markdown: render(content, true),
    };
}

function extractId(s: string): string {
    const m = s.match(/\/document\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1]! : s.trim();
}

function paraText(p: any): string {
    let t = "";
    for (const el of p.elements || []) if (el.textRun) t += el.textRun.content;
    return t.replace(/\n$/, "");
}

function render(content: any[], md: boolean): string {
    let out = "";
    for (const element of content || []) {
        if (element.paragraph) {
            const p = element.paragraph;
            const text = paraText(p);
            const style = p.paragraphStyle?.namedStyleType || "";
            const bullet = p.bullet;
            if (md && /^HEADING_(\d)$/.test(style)) {
                const level = Number(style.match(/HEADING_(\d)/)![1]);
                out += `${"#".repeat(level)} ${text}\n\n`;
            } else if (md && style === "TITLE") {
                out += `# ${text}\n\n`;
            } else if (md && bullet) {
                out += `- ${text}\n`;
            } else {
                out += text + "\n";
                if (md) out += "\n";
            }
        } else if (element.table) {
            for (const row of element.table.tableRows || []) {
                const cells = (row.tableCells || []).map((cell: any) => render(cell.content, md).replace(/\n+/g, " ").trim());
                out += md ? `| ${cells.join(" | ")} |\n` : cells.join("\t") + "\n";
            }
            if (md) out += "\n";
        }
    }
    return out.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
