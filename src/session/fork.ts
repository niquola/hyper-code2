export default function (ctx: Context, opts: { id: string; title?: string; offset?: number }): types.agent.Agent {
    const { id } = opts;
    const parent = (ctx.state as any).agent?.[id] ?? ctx.fns.session.load(ctx, { id });
    if (!parent) throw new Error(`agent not found: ${id}`);
    const fullCount = ctx.fns.session.getFullMessages(ctx, { id }).length;
    const agent = ctx.fns.agent.start(ctx, {
        model: parent.model,
        systemPrompt: parent.systemPrompt,
        parentId: parent.id,
        forkOffset: opts.offset ?? fullCount,
    });
    agent.scratchpad = JSON.parse(JSON.stringify(parent.scratchpad ?? {}));
    ctx.fns.session.save(ctx, { agent });
    ctx.fns.events.emitAgentsChanged(ctx, { agentId: agent.id, reason: "fork" });
    return agent;
}
