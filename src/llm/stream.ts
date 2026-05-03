// Dispatcher — picks the wire-protocol implementation based on endpoint.api.
// Same return shape regardless of provider — callers don't care.
export default async function (
    ctx: Context,
    opts: { agent: types.agent.Agent; signal?: AbortSignal; onEvent?: (ev: any) => void },
) {
    const { agent } = opts;
    const ep = ctx.fns.llm.resolveEndpoint(ctx, { model: agent.model });
    if (ep.api === "mock") return ctx.fns.llm.streamMock(ctx, opts);
    if (ep.api === "anthropic") return ctx.fns.llm.streamAnthropic(ctx, opts);
    if (ep.api === "responses") return ctx.fns.llm.streamCodex(ctx, opts);
    return ctx.fns.llm.streamOpenAI(ctx, opts);
}
