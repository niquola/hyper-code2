/**
 * Signals the embedded cron worker to rescan Postgres.
 *
 * Provides an in-process optimization after local schedule changes while durable job data remains in Postgres.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<void> {
    (ctx.state as any).cron ??= {};
    (ctx.state as any).cron.wakePending = true;
    const waiters: Set<() => void> | undefined = (ctx.state as any).cron.waiters;
    if (!waiters) return;
    (ctx.state as any).cron.waiters = new Set();
    for (const wake of waiters) { try { wake(); } catch {} }
}
