/**
 * Lists recent cron jobs and their execution state.
 *
 * Reads pending, running, and completed cron occurrences for operational inspection, optionally filtered by schedule name.
 * @param opts.name Optional exact schedule name filter.
 * @param opts.limit Maximum rows returned. @default 100 @minimum 1 @maximum 500
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Optional exact schedule name filter. */
        name?: string;
        /** Maximum rows returned. @default 100 @minimum 1 @maximum 500 */
        limit?: number;
    },
): Promise<any[]> {
    const limit = Math.max(1, Math.min(500, Math.floor(opts.limit ?? 100)));
    return await ctx.fns.procs.db.select({ sql: `SELECT id, name, fn, args, run_at AS "runAt", every_ms AS "everyMs", status, started_at AS "startedAt", finished_at AS "finishedAt", result, error FROM cron_jobs WHERE (?::text IS NULL OR name = ?) ORDER BY id DESC LIMIT ?`, params: [opts.name ?? null, opts.name ?? null, limit] }) as any[];
}
