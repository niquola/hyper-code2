export default function (ctx: Context, _session: Session | null, payload: { agentId?: string; reason?: string } = {}): void {
    ctx.fns.procs.events.emit({ event: { type: "agents.changed", ...payload } });
}
