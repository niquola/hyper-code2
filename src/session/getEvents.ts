export default function (ctx: Context, _session: Session | null, opts: { id: string; fromIdx?: number; limit?: number }): any[] {
    const { id } = opts;
    const fromIdx = Number(opts.fromIdx ?? 0);
    const limitClause = opts.limit && opts.limit > 0 ? ` LIMIT ${Number(opts.limit)}` : '';
    const sql = fromIdx > 0
        ? `SELECT idx, payload FROM events WHERE agent_id = ? AND idx >= ? ORDER BY idx ASC${limitClause}`
        : `SELECT idx, payload FROM events WHERE agent_id = ? ORDER BY idx ASC${limitClause}`;
    const params = fromIdx > 0 ? [id, fromIdx] : [id];
    const rows = ctx.fns.procs.db.select({ sql, params }) as any[];
    return rows.map((r: any) => JSON.parse(r.payload));
}
