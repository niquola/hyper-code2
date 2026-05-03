export default function (
    ctx: Context,
    opts: { model: string; systemPrompt?: string; parentId?: string | null; forkOffset?: number | null },
): types.agent.Agent {
    const id = ctx.fns.agent.nextId(ctx);
    const agent: types.agent.Agent = {
        id,
        model: opts.model,
        systemPrompt: opts.systemPrompt ?? "",
        messages: [],
        events: [],
        cursors: {},
        subscribers: new Set(),
        waiters: [],
        isStreaming: false,
        abortController: null,
        scratchpad: {},
        parentId: opts.parentId ?? null,
        forkOffset: opts.forkOffset ?? null,
        currentJobId: null,
        drainPromise: null,
    };
    (ctx.state as any).agent ??= {};
    (ctx.state as any).agent[id] = agent;
    ctx.fns.session?.save?.(ctx, { agent });
    ctx.fns.events?.emitAgentsChanged?.(ctx, { agentId: agent.id, reason: "create" });
    return agent;
}
