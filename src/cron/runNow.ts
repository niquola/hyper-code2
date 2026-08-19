/**
 * Makes an enabled cron task immediately due.
 * @param opts.name Exact task name to run.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Exact task name. */ name: string;
}): Promise<{ name: string; nextRunAt: number }> {
    const now=Date.now(); const rows=await ctx.fns.procs.db.select({sql:`UPDATE cron_tasks SET enabled=TRUE,next_run_at=?,updated_at=? WHERE name=? AND state='idle' RETURNING name,next_run_at AS "nextRunAt"`,params:[now,now,opts.name]});
    if(!rows[0]) throw new Error(`cron task not found or running: ${opts.name}`); ctx.fns.cron.wakeWorker({}); return rows[0] as any;
}
