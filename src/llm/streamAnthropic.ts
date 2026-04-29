// Stream from an Anthropic Messages API endpoint (anthropic.com, kimi.com/coding, etc).
// Same return shape as streamOpenAI: {text, thinking, toolCalls, finishReason, usage}.
export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    opts: { signal?: AbortSignal; onEvent?: (ev: any) => void } = {},
): Promise<{
    text: string;
    thinking: string;
    toolCalls: Array<{ id: string; name: string; arguments: string }>;
    finishReason: string | null;
    usage: any;
}> {
    const ep = ctx.fns.llm.resolveEndpoint(ctx, agent.model);

    const system = await ctx.fns.agent.fullSystemPrompt(ctx, agent);

    const body: any = {
        model: ep.modelId,
        system,
        messages: ctx.fns.llm.toAnthropicMessages(agent.messages),
        stream: true,
        max_tokens: 8192,
    };
    if (agent.tools?.length) {
        body.tools = agent.tools.map((t: any) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters ?? { type: "object", properties: {} },
        }));
    }

    // Default Anthropic SDK behavior: x-api-key + anthropic-version.
    // Real Anthropic OAuth tokens ("sk-ant-oat*") would need Claude-Code identity headers —
    // add later. kimi-coding uses its own JWT via Bearer, not sk-ant-oat.
    const headers: Record<string, string> = {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
    };
    // kimi-coding JWT has ~15min TTL — auto-refresh via refresh_token if near expiry.
    let apiKey = ep.apiKey;
    if (ep.provider === "kimi-coding") {
        const fresh = await ctx.fns.llm.refreshKimiCode(ctx);
        if (fresh) apiKey = fresh;
    }
    if (apiKey) {
        if (apiKey.startsWith("sk-ant-oat") || ep.provider === "kimi-coding") {
            headers["authorization"] = `Bearer ${apiKey}`;
        } else {
            headers["x-api-key"] = apiKey;
        }
    }

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
    const blocks: Record<number, { id?: string; name?: string; type?: string; argsRaw?: string }> = {};
    const toolCalls: Record<number, { id: string; name: string; arguments: string }> = {};
    let finishReason: string | null = null;
    let usage: any = { prompt_tokens: 0, completion_tokens: 0 };

    for await (const ev of parseSSE(res.body)) {
        if (ev.type === "message_start") {
            const u = ev.data.message?.usage;
            if (u) usage.prompt_tokens = u.input_tokens ?? 0;
        } else if (ev.type === "content_block_start") {
            blocks[ev.data.index] = {
                id: ev.data.content_block?.id,
                name: ev.data.content_block?.name,
                type: ev.data.content_block?.type,
                argsRaw: "",
            };
        } else if (ev.type === "content_block_delta") {
            const b = blocks[ev.data.index];
            const d = ev.data.delta ?? {};
            if (d.type === "text_delta" && typeof d.text === "string") {
                text += d.text;
                opts.onEvent?.({ type: "text_delta", delta: d.text });
            } else if (d.type === "thinking_delta" && typeof d.thinking === "string") {
                thinking += d.thinking;
                opts.onEvent?.({ type: "thinking_delta", delta: d.thinking });
            } else if (d.type === "input_json_delta" && typeof d.partial_json === "string" && b) {
                b.argsRaw = (b.argsRaw ?? "") + d.partial_json;
            }
        } else if (ev.type === "content_block_stop") {
            const b = blocks[ev.data.index];
            if (b && b.type === "tool_use" && b.id && b.name) {
                toolCalls[ev.data.index] = { id: b.id, name: b.name, arguments: b.argsRaw ?? "{}" };
            }
        } else if (ev.type === "message_delta") {
            if (ev.data.delta?.stop_reason) finishReason = ev.data.delta.stop_reason;
            if (ev.data.usage?.output_tokens != null) usage.completion_tokens = ev.data.usage.output_tokens;
        }
    }

    return {
        text,
        thinking,
        toolCalls: Object.keys(toolCalls).sort((a, b) => +a - +b).map(k => toolCalls[+k]!),
        finishReason: mapStop(finishReason),
        usage,
    };
}

function mapStop(r: string | null): string | null {
    if (!r) return null;
    if (r === "end_turn" || r === "stop_sequence") return "stop";
    if (r === "tool_use") return "tool_calls";
    if (r === "max_tokens") return "length";
    return r;
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{ type: string; data: any }> {
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            let type = "message";
            let dataLine = "";
            // Kimi's SSE omits the space after the colon (event:foo / data:{...}),
            // while Anthropic's uses "event: foo". Handle both.
            for (const line of raw.split("\n")) {
                if (line.startsWith("event:")) type = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLine += line.slice(5).trimStart();
            }
            if (!dataLine) continue;
            try { yield { type, data: JSON.parse(dataLine) }; } catch { /* skip malformed */ }
        }
    }
}
