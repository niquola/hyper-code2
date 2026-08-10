export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; signal?: AbortSignal; onEvent?: (ev: any) => void },
): Promise<{
    text: string;
    thinking: string;
    finishReason: string | null;
    usage: any;
}> {
    const { agent } = opts;
    const { system: sys, messages: convo } = await ctx.fns.agent.buildLlmRequest({ agent });
    const messages: any[] = [];
    if (sys) messages.push({ role: "system", content: sys });
    messages.push(...convo);

    const ep = await ctx.fns.llm.resolveEndpoint({ model: agent.model });

    const body: any = {
        model: ep.modelId,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        prompt_cache_key: agent.id,
    };

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (ep.apiKey) headers["authorization"] = `Bearer ${ep.apiKey}`;

    const res = await fetch(ep.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        // 45s to FIRST byte — a connect that never answers must not hold the run.
        signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`${ep.provider} ${res.status}: ${await res.text()}`);
    if (!res.body) throw new Error("empty response body");

    let text = "";
    let thinking = "";
    let finishReason: string | null = null;
    let usage: any = undefined;

    for await (const { data } of ctx.fns.llm.parseSSE({ body: res.body })) {
        if (data === "[DONE]") break;
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (parsed.usage) usage = parsed.usage;
        const choice = parsed.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta ?? {};
        if (typeof delta.content === "string" && delta.content.length > 0) {
            text += delta.content;
            opts.onEvent?.({ type: "text_delta", delta: delta.content });
        }
        if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
            thinking += delta.reasoning_content;
            opts.onEvent?.({ type: "thinking_delta", delta: delta.reasoning_content });
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    return { text, thinking, finishReason, usage };
}
