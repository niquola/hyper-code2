export default function (ctx: Context, payload: { agentId?: string; reason?: string } = {}): void {
    ctx.fns.events.emit(ctx, { event: { type: "agents.changed", ...payload } });
}
