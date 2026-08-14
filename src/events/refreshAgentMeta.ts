/**
 * Requests a refresh of one agent metadata topic.
 * @param opts.agentId Target agent identifier.
 * @param opts.reason Human-readable refresh reason.
 */
export default function (ctx: Context, _session: Session | null, opts: { agentId: string; reason?: string }): void {
    ctx.fns.procs.events.refresh({ topic: `agent-meta:${opts.agentId}`, reason: opts.reason ?? "meta" });
}
