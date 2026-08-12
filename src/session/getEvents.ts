export default async function (ctx: Context, _session: Session | null, opts: { id: string; fromIdx?: number; beforeIdx?: number; limit?: number }): Promise<any[]> {
    const { id } = opts;
    const fromIdx = Number(opts.fromIdx ?? 0);
    const beforeIdx = opts.beforeIdx == null ? null : Math.max(0, Number(opts.beforeIdx));
    const limit = opts.limit && opts.limit > 0 ? Math.max(1, Math.floor(Number(opts.limit))) : 0;
    let sql: string;
    let params: any[];
    if (beforeIdx != null) {
        // Fetch backwards for an efficient page, then restore transcript order.
        sql = `SELECT * FROM (SELECT idx, payload, ts FROM events WHERE agent_id = ? AND idx < ? ORDER BY idx DESC${limit ? ` LIMIT ${limit}` : ''}) AS page ORDER BY idx ASC`;
        params = [id, beforeIdx];
    } else {
        const limitClause = limit ? ` LIMIT ${limit}` : '';
        sql = fromIdx > 0
            ? `SELECT idx, payload, ts FROM events WHERE agent_id = ? AND idx >= ? ORDER BY idx ASC${limitClause}`
            : `SELECT idx, payload, ts FROM events WHERE agent_id = ? ORDER BY idx ASC${limitClause}`;
        params = fromIdx > 0 ? [id, fromIdx] : [id];
    }
    const rows = (await ctx.fns.procs.db.select({ sql, params })) as any[];
    return rows.map((r: any) => ({ ...JSON.parse(r.payload), idx: Number(r.idx), ts: Number(r.ts) }));
}
