export default function (ctx: Context, opts: { id: string }): number {
    const { id } = opts;
    const row = ctx.fns.db.select<any>(ctx, {
        sql: 'SELECT MAX(idx) AS max_idx, COUNT(*) AS n FROM events WHERE agent_id = ?',
        params: [id],
    })[0];
    if (!row) return -1;
    if (Number(row.n ?? 0) === 0) return -1;
    return Number(row.max_idx ?? -1);
}
