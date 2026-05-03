// Wait until some event is appended for this agent, or until timeoutMs elapses, or until signal aborts.
// Resolves with { woken: true | false }. Designed for long-poll handlers.
export default function (
    ctx: Context,
    opts: { agentId: string; timeoutMs: number; signal?: AbortSignal },
): Promise<{ woken: boolean }> {
    const { agentId, timeoutMs, signal } = opts;
    const map: Map<string, Set<() => void>> = ((ctx.state as any).eventWaiters ??= new Map());
    return new Promise((resolve) => {
        let settled = false;
        const set = map.get(agentId) ?? new Set<() => void>();
        if (!map.has(agentId)) map.set(agentId, set);

        const cleanup = () => {
            set.delete(onWake);
            if (set.size === 0) map.delete(agentId);
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        };

        const onWake = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve({ woken: true });
        };

        const onTimeout = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve({ woken: false });
        };

        const onAbort = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve({ woken: false });
        };

        set.add(onWake);
        const timer = setTimeout(onTimeout, Math.max(0, timeoutMs));
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
