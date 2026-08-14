export default async function (ctx: Context, _session: Session | null, opts: { id: string; activeOnly?: boolean }): Promise<any[]> {
    const rows = await ctx.fns.procs.db.select({
        sql: `SELECT id, predicate, opts, reason, interval_ms, next_check_at, timeout_at, status, attempts, last_error, created_at, finished_at
                FROM agent_watches WHERE agent_id = ? ${opts.activeOnly !== false ? "AND status = 'active'" : ""}
               ORDER BY created_at DESC LIMIT 50`,
        params: [opts.id],
    }) as any[];
    return rows.map((row: any) => ({ ...row, opts: typeof row.opts === "string" ? JSON.parse(row.opts) : row.opts }));
}
