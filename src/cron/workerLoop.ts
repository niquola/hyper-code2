/**
 * Drains due cron tasks inside the current Bun process.
 *
 * Runs the embedded database-backed scheduler with bounded concurrency and a polling fallback; start it from the cron lifecycle hook.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<void> {
    const state = ((ctx.state as any).cron ??= {}); const inflight = new Set<Promise<any>>(); const maxParallel = 4; const maxIdleMs = 30000;
    const wait = (ms: number) => { if (state.wakePending) { state.wakePending = false; return Promise.resolve(); } return new Promise<void>((resolve) => { let done = false; const set: Set<() => void> = (state.waiters ??= new Set()); const finish = () => { if (done) return; done = true; clearTimeout(timer); set.delete(finish); resolve(); }; const timer = setTimeout(finish, Math.max(50, ms)); set.add(finish); }); };
    while (state.running) {
        let claimed = false;
        while (state.running && inflight.size < maxParallel) {
            const job = await ctx.fns.cron.claim({ now: Date.now() }); if (!job) break; claimed = true;
            const promise = ctx.fns.cron.runOne({ id: Number(job.id) }).catch((error: any) => ctx.fns.procs.log.error({ event: "cron.run.failed", msg: String(error?.stack ?? error), jobId: Number(job.id) })).finally(() => { inflight.delete(promise); ctx.fns.cron.wakeWorker({}); });
            inflight.add(promise);
        }
        if (!state.running) break;
        if (!claimed) { const rows = await ctx.fns.procs.db.select({ sql: "SELECT MIN(run_at) AS next FROM cron_jobs WHERE status = 'pending'" }); const next = Number((rows[0] as any)?.next ?? Date.now() + maxIdleMs); await wait(Math.min(maxIdleMs, Math.max(50, next - Date.now()))); }
    }
    if (inflight.size) await Promise.allSettled([...inflight]);
}
