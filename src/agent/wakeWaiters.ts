// Resolve every promise waiting for an event on this agent.
// Long-poll handlers register via ctx.fns.agent.waitForEvent; session.append*Event hooks call this.
/** Wake waiters for the runtime.  * @param opts.agentId Target agent identifier.
*/
export default function (ctx: Context, _session: Session | null, opts: {
        /** Agent id used by the operation. */
agentId: string }): number {
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
