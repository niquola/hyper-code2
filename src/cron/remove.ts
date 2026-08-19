/**
 * Removes an ad-hoc cron task or disables a file-declared task.
 * @param opts.name Exact task name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Exact task name. */ name: string;
}): Promise<{ removed: number; disabled: number }> {
    const rows=await ctx.fns.procs.db.select({sql:"SELECT source FROM cron_tasks WHERE name=?",params:[opts.name]}); const task:any=rows[0]; if(!task) return {removed:0,disabled:0};
    if(task.source==='declared'){const r=await ctx.fns.procs.db.run({sql:"UPDATE cron_tasks SET enabled=FALSE,updated_at=? WHERE name=?",params:[Date.now(),opts.name]}); ctx.fns.cron.wakeWorker({}); return {removed:0,disabled:r.changes};}
    const r=await ctx.fns.procs.db.run({sql:"DELETE FROM cron_tasks WHERE name=? AND state='idle'",params:[opts.name]}); ctx.fns.cron.wakeWorker({}); return {removed:r.changes,disabled:0};
}
