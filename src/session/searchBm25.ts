// BM25 keyword search over all transcripts (ParadeDB @@@ on messages_bm25).
// Returns hits ordered by relevance with a highlighted snippet (<b>…</b>).
// Query syntax: bare terms (OR by default), "quoted phrases", AND/OR, field:term.
//   ctx.fns.session.searchBm25({ q: "postgres migration", agentId?: "cf", limit?: 20 })
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { q: string; agentId?: string; limit?: number },
): Promise<types.session.Bm25Hit[]> {
    const limit = Math.min(Math.max(1, opts.limit ?? 20), 100);
    const where = opts.agentId ? "content @@@ ? AND agent_id = ?" : "content @@@ ?";
    const params = opts.agentId ? [opts.q, opts.agentId] : [opts.q];
    const rows = await ctx.fns.procs.db.select({
        sql: `SELECT agent_id AS "agentId", idx, role, ts,
                     paradedb.score(id) AS score,
                     paradedb.snippet(content) AS snippet
                FROM messages
               WHERE ${where}
               ORDER BY score DESC
               LIMIT ${limit}`,
        params,
    });
    return rows.map((r: any) => ({
        agentId: r.agentId,
        idx: Number(r.idx),
        role: r.role,
        ts: Number(r.ts),
        score: Number(r.score),
        snippet: String(r.snippet ?? ""),
    }));
}
