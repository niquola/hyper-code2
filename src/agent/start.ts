export default function (
    ctx: Context,
    opts: { model: string; systemPrompt?: string; tools?: any[] },
): types.agent.Agent {
    const id = `agent_${crypto.randomUUID().slice(0, 8)}`;
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
    };
    (ctx.state as any).agent ??= {};
    (ctx.state as any).agent[id] = agent;
    return agent;
}
