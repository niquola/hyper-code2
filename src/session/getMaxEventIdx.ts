export default function (ctx: Context, _session: Session | null, opts: { id: string }): number {
    const { id } = opts;
    const row = (ctx.fns.procs.db.select({
        sql: 'SELECT MAX(idx) AS max_idx, COUNT(*) AS n FROM events WHERE agent_id = ?',
        params: [id],
    }) as any[])[0];
    if (!row) return -1;
    if (Number(row.n ?? 0) === 0) return -1;
    return Number(row.max_idx ?? -1);
}
