// Dispatcher — picks the wire-protocol implementation based on endpoint.api.
// Same return shape regardless of provider — callers don't care.
export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    opts: { signal?: AbortSignal; onEvent?: (ev: any) => void } = {},
) {
    const ep = ctx.fns.llm.resolveEndpoint(ctx, agent.model);
    if (ep.api === "anthropic") return ctx.fns.llm.streamAnthropic(ctx, agent, opts);
    return ctx.fns.llm.streamOpenAI(ctx, agent, opts);
}
