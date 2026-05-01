export default function (
    ctx: Context,
    opts: { model: string; systemPrompt?: string; tools?: any[]; parentId?: string | null; forkOffset?: number | null },
): types.agent.Agent {
    // Prefer ctx.fns.agent.nextId (sequential a, b, c… via kv table) when available.
    // Fallback to UUID-suffixed id keeps unit tests that don't wire nextId working.
    const id = typeof ctx.fns.agent?.nextId === 'function'
        ? ctx.fns.agent.nextId(ctx)
        : 'agent_' + crypto.randomUUID().slice(0, 8);
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
        tools: opts.tools ?? [],
        scratchpad: {},
        parentId: opts.parentId ?? null,
        forkOffset: opts.forkOffset ?? null,
        currentJobId: null,
        drainPromise: null,
    };
    (ctx.state as any).agent ??= {};
    (ctx.state as any).agent[id] = agent;
    ctx.fns.session?.save?.(ctx, agent);
    ctx.fns.events?.emitAgentsChanged?.(ctx, { agentId: agent.id, reason: "create" });
    return agent;
}
