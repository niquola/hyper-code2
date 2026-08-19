/**
 * Enables or disables a cron task.
 *
 * Persists the operational enabled status in Postgres without changing a file-backed task definition.
 * @param opts.name Exact cron task name.
 * @param opts.enabled Desired scheduler status.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Exact cron task name. */
        name: string;
        /** Desired scheduler status. */
        enabled: boolean;
    },
): Promise<{ name: string; enabled: boolean; nextRunAt: number | null }> {
    const now=Date.now(); const rows=await ctx.fns.procs.db.select({sql:`UPDATE cron_tasks SET enabled=?, next_run_at=CASE WHEN ? AND next_run_at IS NULL AND schedule_type='interval' THEN ?+every_ms ELSE next_run_at END, updated_at=? WHERE name=? RETURNING name,enabled,next_run_at AS "nextRunAt"`,params:[opts.enabled,opts.enabled,now,now,opts.name]}); if(!rows[0]) throw new Error(`cron task not found: ${opts.name}`); ctx.fns.cron.wakeWorker({}); return rows[0] as any;
}
