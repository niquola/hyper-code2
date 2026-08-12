// Dispatcher — picks the wire-protocol implementation based on endpoint.api.
// Same return shape regardless of provider — callers don't care.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; signal?: AbortSignal; onEvent?: (ev: any) => void },
) {
    const { agent } = opts;
    const ep = await ctx.fns.llm.resolveEndpoint({ model: agent.model });
    const started = performance.now();
    let firstEventMs: number | undefined;
    const onEvent = (ev: any) => {
        firstEventMs ??= Math.round((performance.now() - started) * 100) / 100;
        opts.onEvent?.(ev);
    };
    const attrs: Record<string, any> = {
        "llm.provider": ep.provider,
        "llm.model": ep.modelId,
        "agent.id": agent.id,
    };
    const request = async () => {
        const wireOpts = { ...opts, onEvent };
        let result: any;
        if (ep.api === "mock") result = await ctx.fns.llm.streamMock(wireOpts);
        else if (ep.api === "anthropic") result = await ctx.fns.llm.streamAnthropic(wireOpts);
        else if (ep.api === "responses") result = await ctx.fns.llm.streamCodex(wireOpts);
        else result = await ctx.fns.llm.streamOpenAI(wireOpts);
        attrs["llm.ttft_ms"] = firstEventMs ?? null;
        attrs["llm.finish_reason"] = result?.finishReason ?? null;
        attrs["llm.prompt_tokens"] = result?.usage?.prompt_tokens ?? result?.usage?.input_tokens ?? null;
        attrs["llm.completion_tokens"] = result?.usage?.completion_tokens ?? result?.usage?.output_tokens ?? null;
        return result;
    };
    const telemetry: any = (ctx.fns.procs as any).telemetry;
    return await (typeof telemetry?.safeSpan === "function"
        ? telemetry.safeSpan({ name: "llm.request", attrs, fn: request })
        : request());
}
