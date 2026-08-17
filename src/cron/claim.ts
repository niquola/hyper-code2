/**
 * Atomically claims one due cron occurrence for execution.
 *
 * Internal worker primitive that moves one due pending row to running using a database lock safe for competing claimers.
 * @param opts.now Timestamp used to select due work.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Timestamp used to select due work. */
        now?: number;
    },
): Promise<any | null> {
    const now = Math.floor(opts.now ?? Date.now());
    const rows = await ctx.fns.procs.db.select({ sql: `WITH due AS (SELECT id FROM cron_jobs WHERE status = 'pending' AND run_at <= ? ORDER BY run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED) UPDATE cron_jobs j SET status = 'running', started_at = ? FROM due WHERE j.id = due.id RETURNING j.*`, params: [now, now] });
    return rows[0] ?? null;
}
