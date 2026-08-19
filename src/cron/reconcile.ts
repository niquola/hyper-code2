/**
 * Reconciles file-declared cron tasks into Postgres.
 *
 * Applies loaded $cron declarations to cron_tasks while preserving each existing task enabled status and next run time.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<{ declared: number; applied: string[]; disabledMissing: string[] }> {
    const declarations:any[]=Object.values((ctx.state as any).cron?.declarations??{}); const applied:string[]=[]; const names=declarations.map(d=>String(d.name));
    for(const d of declarations){const now=Date.now(); const rows=await ctx.fns.procs.db.select({sql:"SELECT name,definition_hash FROM cron_tasks WHERE name=?",params:[d.name]}); const current:any=rows[0]; if(current?.definition_hash===d.definitionHash) continue; await ctx.fns.procs.db.run({sql:`INSERT INTO cron_tasks(name,fn,args,schedule_type,every_ms,next_run_at,enabled,state,source,source_file,definition_hash,created_at,updated_at) VALUES(?, ?, ?::jsonb, 'interval', ?, ?, TRUE, 'idle', 'declared', ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET fn=excluded.fn,args=excluded.args,schedule_type='interval',every_ms=excluded.every_ms,source='declared',source_file=excluded.source_file,definition_hash=excluded.definition_hash,updated_at=excluded.updated_at,next_run_at=COALESCE(cron_tasks.next_run_at,excluded.next_run_at)`,params:[d.name,d.fn,JSON.stringify(d.args??{}),d.everyMs,d.now?now:now+d.everyMs,d.sourceFile,d.definitionHash,now,now]}); applied.push(d.name);}
    const disabledMissing:string[]=[]; const existing=await ctx.fns.procs.db.select({sql:"SELECT name FROM cron_tasks WHERE source='declared'",params:[]}); for(const row of existing as any[]) if(!names.includes(String(row.name))){await ctx.fns.procs.db.run({sql:"UPDATE cron_tasks SET enabled=FALSE,updated_at=? WHERE name=?",params:[Date.now(),row.name]}); disabledMissing.push(String(row.name));}
    ctx.fns.cron.wakeWorker({}); return {declared:declarations.length,applied,disabledMissing};
}
