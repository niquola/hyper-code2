export default function (ctx: Context, _session: Session | null, opts: { id: string; title?: string; offset?: number }): types.agent.Agent {
    const { id } = opts;
    const parent = (ctx.state as any).agent?.[id] ?? ctx.fns.session.load({ id });
    if (!parent) throw new Error(`agent not found: ${id}`);
    const fullCount = ctx.fns.session.getFullMessages({ id }).length;
    const agent = ctx.fns.agent.start({
        model: parent.model,
        systemPrompt: parent.systemPrompt,
        parentId: parent.id,
        forkOffset: opts.offset ?? fullCount,
    });
    agent.scratchpad = JSON.parse(JSON.stringify(parent.scratchpad ?? {}));
    ctx.fns.session.save({ agent });
    ctx.fns.events.emitAgentsChanged({ agentId: agent.id, reason: "fork" });
    return agent;
}
