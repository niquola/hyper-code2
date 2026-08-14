/** Search for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Search query. */
query: string;
        /** Maximum number of results to return. */
limit?: number }): Promise<Array<{
    agentId: string;
    idx: number;
    role: string;
    content: string;
    ts: number;
}>> {
    const q = String(opts.query ?? "").trim();
    if (!q) return [];
    // Postgres: ILIKE for case-insensitive match; camelCase alias must be
    // quoted (pg folds unquoted identifiers to lowercase); ts is BIGINT → string.
    const rows = (await ctx.fns.procs.db.select({
        sql: `
        SELECT agent_id AS "agentId", idx, role, content, ts
        FROM messages
        WHERE content IS NOT NULL
          AND content ILIKE ?
        ORDER BY ts DESC
        LIMIT ?
    `,
        params: [`%${q}%`, opts.limit ?? 50],
    })) as any[];
    return rows.map((r: any) => ({ ...r, ts: Number(r.ts) }));
}
