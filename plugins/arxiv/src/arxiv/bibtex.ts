/** Generates a BibTeX `@misc` citation for one arXiv paper. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Identifier of the paper whose authors and metadata form the citation. */
        id: string;
    },
): Promise<{ id: string; key: string; bibtex: string }> {
    const paper = await ctx.fns.arxiv.get({ id: opts.id });
    const year = paper.published.slice(0, 4) || "????";
    const surname = (paper.authors[0] ?? "unknown").split(/\s+/).at(-1)?.toLowerCase().replace(/[^a-z]/g, "") || "unknown";
    const key = `${surname}${year}_${paper.id.replace(/[^a-zA-Z0-9]/g, "")}`;
    const primaryCategory = paper.categories[0];
    const bibtex = [
        `@misc{${key},`,
        `  title         = {${paper.title}},`,
        `  author        = {${paper.authors.join(" and ")}},`,
        `  year          = {${year}},`,
        `  eprint        = {${paper.id}},`,
        `  archivePrefix = {arXiv},`,
        primaryCategory ? `  primaryClass  = {${primaryCategory}},` : "",
        `  url           = {${paper.link}}`,
        `}`,
    ].filter(Boolean).join("\n");
    return { id: paper.id, key, bibtex };
}
