/**
 * Lists execution history for one cron task.
 *
 * Reads recent immutable run rows for the cron task detail page and operational debugging.
 * @param opts.name Exact cron task name.
 * @param opts.limit Maximum run rows returned. @default 100 @minimum 1 @maximum 500
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Exact cron task name. */
        name: string;
        /** Maximum run rows returned. @default 100 @minimum 1 @maximum 500 */
        limit?: number;
    },
): Promise<any[]> {
    const limit=Math.max(1,Math.min(500,Math.floor(opts.limit??100)));
    return await ctx.fns.procs.db.select({sql:`SELECT id,task_name AS "taskName",fn,args,scheduled_at AS "scheduledAt",started_at AS "startedAt",finished_at AS "finishedAt",status,result,error FROM cron_runs WHERE task_name=? ORDER BY id DESC LIMIT ?`,params:[opts.name,limit]}) as any[];
}
