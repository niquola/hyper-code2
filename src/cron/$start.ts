/** Starts the embedded cron worker after recovering jobs interrupted by a previous process exit. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    if (ctx.env.CRON_WORKER === "off") {
        ctx.fns.procs.log.info({ event: "cron.worker.disabled", msg: "embedded cron worker disabled by CRON_WORKER=off" });
        return {};
    }
    await ctx.fns.cron.recover({});
    (ctx.state as any).cron ??= {};
    await ctx.fns.cron.reconcile({});
    (ctx.state as any).cron.running = true;
    queueMicrotask(() => ctx.fns.cron.workerLoop({}).catch((error: any) =>
        ctx.fns.procs.log.error({ event: "cron.worker.crashed", msg: String(error?.stack ?? error) })));
    return {};
}
