// Wake the workerLoop. Fired from POST /agent/:id, stop, and runOne's
// finally — anything that may have produced new work for the loop.
//
// Edge-triggered: we set a `workerWakePending` flag BEFORE walking the
// waiter set. If a wake fires while the loop is between "decided to
// sleep" and "actually parked on the condvar", the next waitForWork
// will observe the flag, clear it, and resolve immediately instead of
// waiting for the 30 s safety poll. That race used to silently stall
// the second-of-two pending agents until the timeout fired.
export default function (ctx: Context): void {
    (ctx.state as any).workerWakePending = true;
    const set: Set<() => void> | undefined = (ctx.state as any).workerWakeWaiters;
    if (!set || set.size === 0) return;
    (ctx.state as any).workerWakeWaiters = new Set();
    for (const fn of set) {
        try { fn(); } catch { /* ignore */ }
    }
}
