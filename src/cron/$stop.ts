/** Stops the embedded cron worker during graceful process shutdown. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    if ((ctx.state as any).cron) (ctx.state as any).cron.running = false;
    ctx.fns.cron.wakeWorker({});
}
