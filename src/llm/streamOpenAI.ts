export default async function (
    ctx: Context,
    opts: { agent: types.agent.Agent; signal?: AbortSignal; onEvent?: (ev: any) => void },
): Promise<{
    text: string;
    thinking: string;
    finishReason: string | null;
    usage: any;
}> {
    const { agent } = opts;
    const { system: sys, messages: convo } = await ctx.fns.agent.buildLlmRequest(ctx, { agent });
    const messages: any[] = [];
    if (sys) messages.push({ role: "system", content: sys });
    messages.push(...convo);

    const ep = ctx.fns.llm.resolveEndpoint(ctx, { model: agent.model });

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
        signal: opts.signal,
    });
    if (!res.ok) throw new Error(`${ep.provider} ${res.status}: ${await res.text()}`);
    if (!res.body) throw new Error("empty response body");

    let text = "";
    let thinking = "";
    let finishReason: string | null = null;
    let usage: any = undefined;

    for await (const chunk of parseSSE(res.body)) {
        if (chunk === "[DONE]") break;
        const data: any = JSON.parse(chunk);
        if (data.usage) usage = data.usage;
        const choice = data.choices?.[0];
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

async function* parseSSE(body: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            for (const line of raw.split("\n")) {
                if (line.startsWith("data: ")) yield line.slice(6);
            }
        }
    }
}
