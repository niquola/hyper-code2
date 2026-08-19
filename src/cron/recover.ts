/** Recovers cron tasks and runs interrupted by a process exit. */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<{ recovered: number }> {
    const now=Date.now();
    const rows=await ctx.fns.procs.db.select({ sql: `UPDATE cron_runs SET status='error', error=COALESCE(error,'process exited while cron run was active'), finished_at=? WHERE status='running' RETURNING task_name`, params:[now] });
    if (rows.length) await ctx.fns.procs.db.run({ sql: `UPDATE cron_tasks SET state='idle', next_run_at=CASE WHEN enabled THEN COALESCE(next_run_at, ?) ELSE next_run_at END, updated_at=? WHERE state='running'`, params:[now,now] });
    return { recovered: rows.length };
}
