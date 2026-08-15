/**
 * Answers a research question with Consensus synthesis, verdict, structured
 * citations, and enriched peer-reviewed papers. Pass `thread_id` for follow-ups.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: types.research.QueryOpts,
): Promise<types.research.AskResult> {
    const query = String(opts?.query ?? "").trim();
    if (!query) throw new Error("research.ask: query is required");
    const limit = Math.max(1, Math.min(opts.limit ?? 10, 50));
    const session = opts.session ?? "research-consensus";
    const started = await ctx.fns.research.start({ ...opts, query, limit, session });
    const interactionPath = `/api/threads/${started.thread_id}/interactions/${started.interaction_id}/`;

    let interaction: any = null;
    for (let attempt = 0; attempt < 20; attempt++) {
        interaction = await ctx.fns.research.call({ session, path: interactionPath });
        if (typeof interaction?.analysis === "string" && interaction.analysis.length > 40) break;
        await Bun.sleep(2500);
    }
    const payload: any = await ctx.fns.research.call({
        session,
        path: `${interactionPath}papers/?limit=${limit}&offset=0`,
    });
    const papers = ctx.fns.research.papers({ papers: payload?.papers ?? [] });
    const markdown = String(interaction?.analysis ?? "");
    return {
        query,
        verdict: firstHeading(markdown),
        meter: parseMeter(markdown),
        answer_md: markdown,
        answer_text: stripTags(markdown),
        citations: parseCitations(markdown, papers),
        papers,
        full_text_paper_ids: (interaction?.full_text_paper_ids ?? []).map(String),
        num_results_analyzed: interaction?.num_results_analyzed,
        ...started,
        thread_url: `https://consensus.app/search/${started.thread_id}/`,
    };
}

function firstHeading(markdown: string): string {
    return (markdown.match(/^#+\s*(.+)$/m)?.[1] ?? "").replace(/\*\*/g, "").trim();
}

function parseMeter(markdown: string): { raw: string } | null {
    const raw = markdown.match(/<consensus_meter[^>]*\/?>/)?.[0];
    return raw ? { raw } : null;
}

function parseCitations(markdown: string, papers: types.research.Paper[]): types.research.Citation[] {
    const byId = new Map(papers.map(paper => [paper.paper_id, paper]));
    return [...markdown.matchAll(/<paper_cite\s+([^>]*?)\/?>/g)].map(match => {
        const attrs = match[1] ?? "";
        const paperId = attribute(attrs, "paper_id");
        const paper = paperId ? byId.get(paperId) : undefined;
        return {
            paper_id: paperId,
            quote: attribute(attrs, "quote"),
            section: attribute(attrs, "section"),
            sid: attribute(attrs, "sid"),
            title: paper?.title,
            doi: paper?.doi,
            year: paper?.year,
        };
    });
}

function attribute(source: string, name: string): string | undefined {
    const match = source.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`));
    return match?.[1] ?? match?.[2];
}

function stripTags(markdown: string): string {
    return markdown
        .replace(/<paper_cite[^>]*\/?>/g, "")
        .replace(/<consensus_meter[^>]*\/?>/g, "")
        .replace(/<figure_caption[^>]*\/?>/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
