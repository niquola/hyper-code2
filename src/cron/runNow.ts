/**
 * Makes a pending cron schedule immediately due.
 *
 * Moves the oldest pending occurrence of a named schedule to the current time for manual execution by the embedded worker.
 * @param opts.name Exact schedule name to run.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Exact schedule name to run. */
        name: string;
    },
): Promise<{ id: number; name: string; runAt: number }> {
    const rows = await ctx.fns.procs.db.select({ sql: `UPDATE cron_jobs SET run_at = ? WHERE id = (SELECT id FROM cron_jobs WHERE name = ? AND status = 'pending' ORDER BY run_at LIMIT 1) RETURNING id, name, run_at AS "runAt"`, params: [Date.now(), opts.name] });
    if (!rows[0]) throw new Error(`no pending cron job named ${opts.name}`); ctx.fns.cron.wakeWorker({}); return rows[0] as any;
}
