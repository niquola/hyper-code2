// Dispatcher — picks the wire-protocol implementation based on endpoint.api.
// Same return shape regardless of provider — callers don't care.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; signal?: AbortSignal; onEvent?: (ev: any) => void },
) {
    const { agent } = opts;
    const ep = await ctx.fns.llm.resolveEndpoint({ model: agent.model });
    if (ep.api === "mock") return ctx.fns.llm.streamMock(opts);
    if (ep.api === "anthropic") return ctx.fns.llm.streamAnthropic(opts);
    if (ep.api === "responses") return ctx.fns.llm.streamCodex(opts);
    return ctx.fns.llm.streamOpenAI(opts);
}
