/** Fetches metadata and abstract for one arXiv paper ID. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { /** arXiv ID, optionally prefixed with `arXiv:` or suffixed by a version. */ id: string },
): Promise<types.arxiv.Paper> {
    const id = String(opts?.id ?? "").trim().replace(/^arXiv:/i, "");
    if (!id) throw new Error("arxiv.get: id is required");
    const feed = await ctx.fns.arxiv.api({ params: { id_list: id } });
    if (feed.error) throw new Error(`arxiv.get: ${feed.error}`);
    const paper = feed.papers[0];
    if (!paper) throw new Error(`arxiv.get: paper not found: ${id}`);
    return paper;
}
