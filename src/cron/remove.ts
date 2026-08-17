/**
 * Cancels pending occurrences of a named cron schedule.
 *
 * Deletes pending jobs and prevents a currently running recurring occurrence from scheduling another occurrence after it finishes.
 * @param opts.name Exact schedule name to cancel.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Exact schedule name to cancel. */
        name: string;
    },
): Promise<{ removed: number; runningDisabled: number }> {
    const name = String(opts.name ?? "").trim(); if (!name) throw new Error("cron.remove requires name");
    const disabled = await ctx.fns.procs.db.run({ sql: "UPDATE cron_jobs SET every_ms = NULL WHERE name = ? AND status = 'running' AND every_ms IS NOT NULL", params: [name] });
    const removed = await ctx.fns.procs.db.run({ sql: "DELETE FROM cron_jobs WHERE name = ? AND status = 'pending'", params: [name] });
    ctx.fns.cron.wakeWorker({}); return { removed: removed.changes, runningDisabled: disabled.changes };
}
