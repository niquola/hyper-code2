import { dirname } from "node:path";

/** Renders a paper's metadata and abstract as Markdown and optionally saves it. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** arXiv paper ID. */
        id: string;
        /** Workspace-relative or absolute output file. */
        out?: string;
    },
): Promise<{ id: string; markdown: string; saved?: string }> {
    const paper = await ctx.fns.arxiv.get({ id: opts.id });
    const markdown = [
        `# ${paper.title}`,
        "",
        `- arXiv ID: \`${paper.id}\``,
        `- URL: ${paper.link}`,
        `- PDF: ${paper.pdf}`,
        `- Authors: ${paper.authors.join(", ")}`,
        `- Published: ${paper.published}`,
        `- Updated: ${paper.updated}`,
        `- Categories: ${paper.categories.join(", ")}`,
        "",
        "## Abstract",
        "",
        paper.summary,
        "",
    ].join("\n");
    if (!opts.out) return { id: paper.id, markdown };
    const resolved = ctx.fns.workspace.resolve({ path: opts.out });
    await ctx.fns.files.mkdir({ path: dirname(resolved) });
    await ctx.fns.files.write({ path: resolved, content: markdown });
    return { id: paper.id, markdown, saved: resolved };
}
