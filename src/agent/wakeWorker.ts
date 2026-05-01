// Wake the single workerLoop. Fired from enqueue and stop so the worker re-checks the queue.
export default function (ctx: Context): void {
    const set: Set<() => void> | undefined = (ctx.state as any).workerWakeWaiters;
    if (!set || set.size === 0) return;
    (ctx.state as any).workerWakeWaiters = new Set();
    for (const fn of set) {
        try { fn(); } catch { /* ignore */ }
    }
}
