// OpenAI Responses API streamer for the ChatGPT subscription via Codex backend
// (`https://chatgpt.com/backend-api/codex/responses`). Auth is the JWT from
// ~/.codex/auth.json — refreshCodex() is called first to ensure freshness.
//
// Same return shape as streamOpenAI / streamAnthropic so the dispatcher in
// stream.ts can swap providers transparently.
export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    opts: { signal?: AbortSignal; onEvent?: (ev: any) => void } = {},
): Promise<{
    text: string;
    thinking: string;
    toolCalls: { id: string; name: string; arguments: string }[];
    finishReason: string | null;
    usage: { prompt_tokens: number; completion_tokens: number };
}> {
    const ep = ctx.fns.llm.resolveEndpoint(ctx, agent.model);
    const apiKey = await ctx.fns.llm.refreshCodex(ctx) ?? ep.apiKey;
    if (!apiKey) throw new Error("codex: no access_token (run /settings → login)");
    const accountId = extractAccountId(apiKey);

    const { input } = ctx.fns.llm.toCodexInput(ctx, agent.messages as any);
    const instructions = await ctx.fns.agent.fullSystemPrompt(ctx, agent);

    const body: any = {
        model: ep.modelId,
        store: false,
        stream: true,
        instructions,
        input,
        text: { verbosity: "medium" },
        tool_choice: "auto",
        parallel_tool_calls: true,
        prompt_cache_key: agent.id,
    };
    if (agent.tools?.length) {
        body.tools = agent.tools.map((t: any) => ({
            type: "function",
            name: t.name,
            description: t.description,
            parameters: t.parameters ?? { type: "object", properties: {} },
            strict: false,
        }));
    }

    const res = await fetch(ep.url, {
        method: "POST",
        headers: {
            "authorization": `Bearer ${apiKey}`,
            "chatgpt-account-id": accountId,
            "originator": "hyper-code2",
            "OpenAI-Beta": "responses=experimental",
            "accept": "text/event-stream",
            "content-type": "application/json",
            "session_id": agent.id,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
    });
    if (!res.ok) throw new Error(`${ep.provider} ${res.status}: ${(await res.text()).slice(0, 500)}`);
    if (!res.body) throw new Error("empty response body");

    let text = "";
    let thinking = "";
    const toolCalls: Record<string, { id: string; name: string; arguments: string }> = {};
    let finishReason: string | null = null;
    const usage = { prompt_tokens: 0, completion_tokens: 0 };

    for await (const ev of parseSSE(res.body)) {
        const t = ev.type;
        if (t === "response.output_item.added") {
            const item = ev.item;
            if (item?.type === "function_call") {
                toolCalls[item.id] = { id: item.call_id, name: item.name, arguments: item.arguments ?? "" };
            }
        } else if (t === "response.output_text.delta" && typeof ev.delta === "string") {
            text += ev.delta;
            opts.onEvent?.({ type: "text_delta", delta: ev.delta });
        } else if (t === "response.reasoning_summary_text.delta" && typeof ev.delta === "string") {
            thinking += ev.delta;
            opts.onEvent?.({ type: "thinking_delta", delta: ev.delta });
        } else if (t === "response.function_call_arguments.delta") {
            const tc = toolCalls[ev.item_id];
            if (tc && typeof ev.delta === "string") tc.arguments += ev.delta;
        } else if (t === "response.function_call_arguments.done") {
            const tc = toolCalls[ev.item_id];
            if (tc && typeof ev.arguments === "string") tc.arguments = ev.arguments;
        } else if (t === "response.completed" || t === "response.incomplete") {
            const u = ev.response?.usage;
            if (u) {
                usage.prompt_tokens = u.input_tokens ?? 0;
                usage.completion_tokens = u.output_tokens ?? 0;
            }
            finishReason = mapStop(ev.response?.status);
            const stop = ev.response?.incomplete_details?.reason;
            if (stop === "max_output_tokens") finishReason = "length";
        } else if (t === "response.failed" || t === "error") {
            const msg = ev.response?.error?.message ?? ev.message ?? "codex stream error";
            throw new Error(`codex: ${msg}`);
        }
    }

    const calls = Object.values(toolCalls);
    if (calls.length > 0) finishReason = "tool_calls";

    return { text, thinking, toolCalls: calls, finishReason, usage };
}

function mapStop(status: string | undefined): string | null {
    if (!status) return null;
    if (status === "completed") return "stop";
    if (status === "incomplete") return "length";
    if (status === "failed" || status === "cancelled") return status;
    return status;
}

function extractAccountId(token: string): string {
    try {
        const payload = token.split(".")[1];
        if (!payload) throw new Error("no payload");
        const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        const id = json?.["https://api.openai.com/auth"]?.chatgpt_account_id;
        if (!id) throw new Error("no chatgpt_account_id");
        return id;
    } catch (e: any) {
        throw new Error(`codex: cannot read account id from token: ${e?.message}`);
    }
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataLines: string[] = [];
            for (const line of raw.split("\n")) {
                if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
            }
            if (!dataLines.length) continue;
            const data = dataLines.join("\n").trim();
            if (!data || data === "[DONE]") continue;
            try { yield JSON.parse(data); } catch { /* skip malformed */ }
        }
    }
}
