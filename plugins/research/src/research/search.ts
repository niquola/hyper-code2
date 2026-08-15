/**
 * Searches Consensus and returns ranked peer-reviewed papers without waiting for
 * an AI synthesis. Use when paper metadata is sufficient or to conserve output.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: types.research.QueryOpts,
): Promise<types.research.SearchResult> {
    const query = String(opts?.query ?? "").trim();
    if (!query) throw new Error("research.search: query is required");
    const limit = Math.max(1, Math.min(opts.limit ?? 10, 50));
    const session = opts.session ?? "research-consensus";
    const started = await ctx.fns.research.start({ ...opts, query, limit, session });
    const path = `/api/threads/${started.thread_id}/interactions/${started.interaction_id}/papers/?limit=${limit}&offset=0`;

    let payload: any = null;
    for (let attempt = 0; attempt < 12; attempt++) {
        payload = await ctx.fns.research.call({ session, path });
        if ((payload?.papers?.length ?? 0) > 0) break;
        await Bun.sleep(2500);
    }
    const results = ctx.fns.research.papers({ papers: payload?.papers ?? [] });
    return {
        query,
        ...started,
        thread_url: `https://consensus.app/search/${started.thread_id}/`,
        total_count: Number(payload?.total_count ?? results.length),
        count: results.length,
        results,
    };
}
