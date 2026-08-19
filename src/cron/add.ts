/**
 * Creates or updates a recurring cron task.
 *
 * Stores an ad-hoc interval task in `cron_tasks`; use `$cron_*.ts` declarations for version-controlled schedules.
 * @param opts.name Stable unique task name.
 * @param opts.fn Dotted runtime function name to invoke.
 * @param opts.every Positive interval string or seconds.
 * @param opts.args JSON-compatible function options.
 * @param opts.now Run the first occurrence immediately. @default false
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Stable unique task name. */ name: string;
    /** Dotted runtime function name. */ fn: string;
    /** Positive interval string or seconds. */ every: string | number;
    /** JSON-compatible function options. */ args?: Record<string, any>;
    /** Run first occurrence immediately. @default false */ now?: boolean;
}): Promise<{ name: string; fn: string; nextRunAt: number; everyMs: number; enabled: boolean }> {
    const everyMs = parseDuration(opts.every);
    const name = String(opts.name ?? "").trim();
    const fn = String(opts.fn ?? "").trim();
    if (!name || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(fn)) throw new Error("cron.add requires a name and dotted runtime function");
    if (everyMs < 1000) throw new Error("cron interval must be at least one second");
    const now = Date.now();
    const nextRunAt = opts.now ? now : now + everyMs;
    const rows = await ctx.fns.procs.db.select({
        sql: `INSERT INTO cron_tasks (name, fn, args, schedule_type, every_ms, next_run_at, enabled, state, source, created_at, updated_at)
              VALUES (?, ?, ?::jsonb, 'interval', ?, ?, TRUE, 'idle', 'adhoc', ?, ?)
              ON CONFLICT (name) DO UPDATE SET fn=excluded.fn, args=excluded.args, schedule_type='interval', every_ms=excluded.every_ms,
                  next_run_at=excluded.next_run_at, enabled=TRUE, source='adhoc', source_file=NULL, definition_hash=NULL, updated_at=excluded.updated_at
              RETURNING name, fn, next_run_at AS "nextRunAt", every_ms AS "everyMs", enabled`,
        params: [name, fn, JSON.stringify(opts.args ?? {}), everyMs, nextRunAt, now, now],
    });
    ctx.fns.cron.wakeWorker({});
    return rows[0] as any;
}

function parseDuration(value: string | number): number {
    if (typeof value === "number") return Math.floor(value * 1000);
    let total = 0, matched = false, consumed = "";
    const re = /(\d+)\s*(d|h|m|s)/gi; let match: RegExpExecArray | null;
    while ((match = re.exec(value))) { matched = true; consumed += match[0]; total += Number(match[1]) * ({ d: 86400000, h: 3600000, m: 60000, s: 1000 } as any)[String(match[2]).toLowerCase()]; }
    if (!matched || consumed.replace(/\s/g, "").length !== value.replace(/\s/g, "").length) throw new Error(`invalid interval: ${value}`);
    return total;
}
