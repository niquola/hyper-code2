export default function (ctx: Context, _session: Session | null, opts: { agentId: string; reason?: string }): void {
    ctx.fns.procs.events.refresh({ topic: `agent-meta:${opts.agentId}`, reason: opts.reason ?? "meta" });
}
