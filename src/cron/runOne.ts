/**
 * Executes one already claimed cron occurrence.
 *
 * Internal worker primitive that invokes the target runtime function, stores its result or error, and schedules the next fixed-delay occurrence.
 * @param opts.id Claimed cron job identifier.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Claimed cron job identifier. */
        id: number;
    },
): Promise<{ id: number; name: string; status: string; ms: number }> {
    const rows = await ctx.fns.procs.db.select({ sql: "SELECT * FROM cron_jobs WHERE id = ? AND status = 'running'", params: [opts.id] });
    const job: any = rows[0]; if (!job) throw new Error(`cron.runOne: running job ${opts.id} not found`);
    const segments = String(job.fn).split("."); let target: any = ctx.fns; for (const segment of segments) target = target?.[segment];
    const started = Date.now(); let status = "done", result: any = null, error: string | null = null;
    try { if (typeof target !== "function") throw new Error(`unknown runtime function: ${job.fn}`); result = await target(typeof job.args === "string" ? JSON.parse(job.args) : (job.args ?? {})); }
    catch (cause: any) { status = "error"; error = String(cause?.stack ?? cause?.message ?? cause).slice(0, 16000); }
    let resultJson = "null"; try { const json = JSON.stringify(result ?? null); resultJson = json.length <= 8192 ? json : JSON.stringify({ truncated: true, bytes: json.length }); } catch { resultJson = JSON.stringify({ unserializable: true }); }
    const finished = Date.now(); const updated = await ctx.fns.procs.db.select({ sql: `UPDATE cron_jobs SET status = ?, result = ?::jsonb, error = ?, finished_at = ? WHERE id = ? RETURNING every_ms AS "everyMs"`, params: [status, resultJson, error, finished, job.id] });
    const everyMs = Number((updated[0] as any)?.everyMs ?? 0);
    if (everyMs > 0) await ctx.fns.procs.db.run({ sql: `INSERT INTO cron_jobs (name, fn, args, run_at, every_ms, status, created_at) VALUES (?, ?, ?::jsonb, ?, ?, 'pending', ?)`, params: [job.name, job.fn, JSON.stringify(job.args ?? {}), finished + everyMs, everyMs, finished] });
    ctx.fns.cron.wakeWorker({}); return { id: Number(job.id), name: String(job.name), status, ms: finished - started };
}
