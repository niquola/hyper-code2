/**
 * Broadcasts that the agent list changed and requests a topic refresh.
 * @param payload.agentId Target agent identifier.
 * @param payload.reason Human-readable refresh reason.
 */
export default function (ctx: Context, _session: Session | null, payload: { agentId?: string; reason?: string } = {}): void {
    ctx.fns.procs.events.emit({ topic: "agents", event: { type: "agents.changed", ...payload } });
    ctx.fns.procs.events.refresh({ topic: "agents", reason: payload.reason });
}
