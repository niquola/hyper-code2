export default async function (ctx: Context, _session: Session | null, opts?: { now?: number; limit?: number }): Promise<{ processed: string[] }> {
    const now = opts?.now ?? Date.now();
    const limit = Math.max(1, Math.min(20, opts?.limit ?? 5));
    const rows = await ctx.fns.procs.db.select({
        sql: `UPDATE agent_watches SET status = 'checking'
               WHERE id IN (
                 SELECT id FROM agent_watches
                  WHERE status = 'active' AND next_check_at <= ?
                  ORDER BY next_check_at LIMIT ? FOR UPDATE SKIP LOCKED
               ) RETURNING id`,
        params: [now, limit],
    }) as any[];
    for (const row of rows) {
        void ctx.fns.agent.deliverWatch({ watchId: row.id, now, claimed: true })
            .catch(async (error: any) => {
                console.error(`watch ${row.id} failed:`, error);
                await ctx.fns.procs.db.run({
                    sql: "UPDATE agent_watches SET status = 'active', last_error = ?, next_check_at = ? WHERE id = ? AND status = 'checking'",
                    params: [String(error?.message ?? error).slice(0, 1000), now + 60_000, row.id],
                }).catch(() => undefined);
            });
    }
    return { processed: rows.map((row: any) => String(row.id)) };
}
