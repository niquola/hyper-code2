/**
 * Lists cron tasks with their latest run status.
 * @param opts.name Optional exact task name filter.
 * @param opts.limit Maximum tasks returned. @default 100 @minimum 1 @maximum 500
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Optional exact task name. */ name?: string;
    /** Maximum tasks returned. @default 100 @minimum 1 @maximum 500 */ limit?: number;
}): Promise<any[]> {
    const limit=Math.max(1,Math.min(500,Math.floor(opts.limit??100)));
    return await ctx.fns.procs.db.select({ sql: `SELECT t.name,t.fn,t.args,t.schedule_type AS "scheduleType",t.every_ms AS "everyMs",t.next_run_at AS "nextRunAt",
        t.enabled,t.state,t.source,t.source_file AS "sourceFile",r.id AS "lastRunId",r.status AS "lastStatus",r.started_at AS "lastStartedAt",
        r.finished_at AS "lastFinishedAt",r.error AS "lastError"
      FROM cron_tasks t LEFT JOIN LATERAL (SELECT * FROM cron_runs WHERE task_name=t.name ORDER BY id DESC LIMIT 1) r ON TRUE
      WHERE (?::text IS NULL OR t.name=?) ORDER BY t.name LIMIT ?`, params:[opts.name??null,opts.name??null,limit] }) as any[];
}
