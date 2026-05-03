// Resolve every promise waiting for an event on this agent.
// Long-poll handlers register via ctx.fns.agent.waitForEvent; session.append*Event hooks call this.
export default function (ctx: Context, opts: { agentId: string }): number {
    const { agentId } = opts;
    const map: Map<string, Set<() => void>> = ((ctx.state as any).eventWaiters ??= new Map());
    const set = map.get(agentId);
    if (!set || set.size === 0) return 0;
    map.delete(agentId);
    let n = 0;
    for (const fn of set) {
        try { fn(); n++; } catch { /* ignore individual failures */ }
    }
    return n;
}
