/**
 * Schedules or replaces a recurring cron task.
 *
 * Creates one durable pending fixed-delay interval job for a registered runtime function; use for recurring background work.
 * @param opts.name Stable unique schedule name.
 * @param opts.fn Dotted runtime function name to invoke.
 * @param opts.every Positive interval string or seconds.
 * @param opts.args JSON-compatible function options.
 * @param opts.now Run the first occurrence immediately. @default false
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Stable unique schedule name. */
        name: string;
        /** Dotted runtime function name to invoke. */
        fn: string;
        /** Positive interval string or seconds. */
        every: string | number;
        /** JSON-compatible function options. */
        args?: Record<string, any>;
        /** Run the first occurrence immediately. @default false */
        now?: boolean;
    },
): Promise<{ id: number; name: string; fn: string; runAt: number; everyMs: number }> {
    const parse = (value: string | number): number => {
        if (typeof value === "number") return value * 1000;
        let total = 0, matched = false, consumed = ""; const re = /(\d+)\s*(d|h|m|s)/gi; let match: RegExpExecArray | null;
        while ((match = re.exec(value))) { matched = true; consumed += match[0]; total += Number(match[1]) * ({ d: 86400000, h: 3600000, m: 60000, s: 1000 } as any)[String(match[2]).toLowerCase()]; }
        if (!matched || consumed.replace(/\s/g, "").length !== value.replace(/\s/g, "").length) throw new Error(`invalid interval: ${value}`); return total;
    };
    const name = String(opts.name ?? "").trim(), fn = String(opts.fn ?? "").trim();
    if (!name || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(fn)) throw new Error("cron.add requires a name and dotted runtime function");
    const everyMs = Math.floor(parse(opts.every)); if (!Number.isFinite(everyMs) || everyMs < 1000) throw new Error("cron interval must be at least one second");
    const now = Date.now(); await ctx.fns.procs.db.run({ sql: "DELETE FROM cron_jobs WHERE name = ? AND status = 'pending'", params: [name] });
    const rows = await ctx.fns.procs.db.select({ sql: `INSERT INTO cron_jobs (name, fn, args, run_at, every_ms, status, created_at) VALUES (?, ?, ?::jsonb, ?, ?, 'pending', ?) RETURNING id, name, fn, run_at AS "runAt", every_ms AS "everyMs"`, params: [name, fn, JSON.stringify(opts.args ?? {}), opts.now ? now : now + everyMs, everyMs, now] });
    ctx.fns.cron.wakeWorker({}); return rows[0] as any;
}
