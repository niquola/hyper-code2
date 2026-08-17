/**
 * Schedules a one-shot cron task for later execution.
 *
 * Creates one durable pending occurrence for a runtime function at an absolute time or after a relative delay.
 * @param opts.fn Dotted runtime function name to invoke.
 * @param opts.name Human-readable job name.
 * @param opts.args JSON-compatible function options.
 * @param opts.at Absolute execution time.
 * @param opts.in Relative duration string or seconds.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Dotted runtime function name to invoke. */
        fn: string;
        /** Human-readable job name. */
        name?: string;
        /** JSON-compatible function options. */
        args?: Record<string, any>;
        /** Absolute execution time. */
        at?: string | number | Date;
        /** Relative duration string or seconds. */
        in?: string | number;
    },
): Promise<{ id: number; name: string; fn: string; runAt: number }> {
    const duration = (value: string | number): number => { if (typeof value === "number") return value * 1000; let total = 0, matched = false, consumed = ""; const re = /(\d+)\s*(d|h|m|s)/gi; let match: RegExpExecArray | null; while ((match = re.exec(value))) { matched = true; consumed += match[0]; total += Number(match[1]) * ({ d: 86400000, h: 3600000, m: 60000, s: 1000 } as any)[String(match[2]).toLowerCase()]; } if (!matched || consumed.replace(/\s/g, "").length !== value.replace(/\s/g, "").length) throw new Error(`invalid duration: ${value}`); return total; };
    const fn = String(opts.fn ?? "").trim(); if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(fn)) throw new Error("cron.defer requires a dotted runtime function");
    if ((opts.at == null) === (opts.in == null)) throw new Error("cron.defer requires exactly one of at or in");
    const runAt = opts.in != null ? Date.now() + duration(opts.in) : new Date(opts.at as any).getTime(); if (!Number.isFinite(runAt)) throw new Error("invalid cron execution time");
    const now = Date.now(); const rows = await ctx.fns.procs.db.select({ sql: `INSERT INTO cron_jobs (name, fn, args, run_at, status, created_at) VALUES (?, ?, ?::jsonb, ?, 'pending', ?) RETURNING id, name, fn, run_at AS "runAt"`, params: [String(opts.name ?? fn), fn, JSON.stringify(opts.args ?? {}), runAt, now] });
    ctx.fns.cron.wakeWorker({}); return rows[0] as any;
}
