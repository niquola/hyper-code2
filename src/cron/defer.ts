/**
 * Creates or replaces an enabled one-shot cron task.
 * @param opts.fn Dotted runtime function name to invoke.
 * @param opts.name Stable task name; defaults to the function name.
 * @param opts.args JSON-compatible function options.
 * @param opts.at Absolute execution time.
 * @param opts.in Relative duration string or seconds.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Dotted runtime function name. */ fn: string;
    /** Stable task name. */ name?: string;
    /** JSON-compatible function options. */ args?: Record<string, any>;
    /** Absolute execution time. */ at?: string | number | Date;
    /** Relative duration string or seconds. */ in?: string | number;
}): Promise<{ name: string; fn: string; nextRunAt: number; enabled: boolean }> {
    const fn = String(opts.fn ?? "").trim();
    if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(fn)) throw new Error("cron.defer requires a dotted runtime function");
    if ((opts.at == null) === (opts.in == null)) throw new Error("cron.defer requires exactly one of at or in");
    const runAt = opts.in != null ? Date.now() + duration(opts.in) : new Date(opts.at as any).getTime();
    if (!Number.isFinite(runAt)) throw new Error("invalid cron execution time");
    const name = String(opts.name ?? fn).trim(), now = Date.now();
    const rows = await ctx.fns.procs.db.select({
        sql: `INSERT INTO cron_tasks (name, fn, args, schedule_type, every_ms, next_run_at, enabled, state, source, created_at, updated_at)
              VALUES (?, ?, ?::jsonb, 'once', NULL, ?, TRUE, 'idle', 'adhoc', ?, ?)
              ON CONFLICT (name) DO UPDATE SET fn=excluded.fn, args=excluded.args, schedule_type='once', every_ms=NULL,
                  next_run_at=excluded.next_run_at, enabled=TRUE, source='adhoc', source_file=NULL, definition_hash=NULL, updated_at=excluded.updated_at
              RETURNING name, fn, next_run_at AS "nextRunAt", enabled`,
        params: [name, fn, JSON.stringify(opts.args ?? {}), runAt, now, now],
    });
    ctx.fns.cron.wakeWorker({}); return rows[0] as any;
}
function duration(value: string | number): number {
    if (typeof value === "number") return value * 1000;
    let total=0, matched=false, consumed=""; const re=/(\d+)\s*(d|h|m|s)/gi; let match: RegExpExecArray|null;
    while ((match=re.exec(value))) { matched=true; consumed+=match[0]; total+=Number(match[1])*({d:86400000,h:3600000,m:60000,s:1000} as any)[String(match[2]).toLowerCase()]; }
    if (!matched || consumed.replace(/\s/g,"").length!==value.replace(/\s/g,"").length) throw new Error(`invalid duration: ${value}`); return total;
}
