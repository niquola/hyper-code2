/**
 * Recovers cron jobs interrupted by a process exit.
 *
 * Marks leftover running occurrences as errors and recreates one future occurrence for each interrupted recurring job during startup.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<{ recovered: number }> {
    const now = Date.now();
    const rows = await ctx.fns.procs.db.select({ sql: `UPDATE cron_jobs SET status = 'error', error = 'process exited while cron job was running', finished_at = ? WHERE status = 'running' RETURNING name, fn, args, every_ms AS "everyMs"`, params: [now] });
    for (const row of rows as any[]) {
        const everyMs = Number(row.everyMs ?? 0);
        if (everyMs > 0) await ctx.fns.procs.db.run({ sql: `INSERT INTO cron_jobs (name, fn, args, run_at, every_ms, status, created_at) VALUES (?, ?, ?::jsonb, ?, ?, 'pending', ?)`, params: [row.name, row.fn, JSON.stringify(row.args ?? {}), now + everyMs, everyMs, now] });
    }
    return { recovered: rows.length };
}
