// OpenAI Responses API streamer for the ChatGPT subscription via Codex backend
// (`https://chatgpt.com/backend-api/codex/responses`). Auth is the JWT from
// ~/.codex/auth.json — refreshCodex() is called first to ensure freshness.
// Same return shape as streamOpenAI / streamAnthropic so the dispatcher in
// stream.ts can swap providers transparently.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; signal?: AbortSignal; onEvent?: (ev: any) => void },
): Promise<{
    text: string;
    thinking: string;
    finishReason: string | null;
    usage: { prompt_tokens: number; completion_tokens: number };
    toolCalls: { id: string; name: string; args: any }[];
}> {
    const { agent } = opts;
    const ep = await ctx.fns.llm.resolveEndpoint({ model: agent.model });
    const apiKey = await ctx.fns.llm.refreshCodex({}) ?? ep.apiKey;
    if (!apiKey) throw new Error("codex: no access_token (run /settings → login)");
    const accountId = extractAccountId(apiKey);

    const { system: instructions, messages: convo } = await ctx.fns.agent.buildLlmRequest({ agent });
    const { input } = ctx.fns.llm.toCodexInput({ messages: convo as any });

    const body: any = {
        model: ep.modelId,
        store: false,
        stream: true,
        instructions,
        input,
        text: { verbosity: "medium" },
        prompt_cache_key: agent.id,
    };

    // Native function_call items, in JSON protocol mode only (agent.wireTools).
    const tools = ctx.fns.agent.wireTools({ agent, api: "responses" });
    if (tools.length) {
        body.tools = tools;
        body.parallel_tool_calls = true;
    }

    // ChatGPT backend occasionally returns 5xx / "upstream connect error"
    // before any bytes ship. Retry pre-stream with exponential backoff.
    const headers = {
        "authorization": `Bearer ${apiKey}`,
        "chatgpt-account-id": accountId,
        "originator": "codex_cli_rs",
        "version": "0.146.0",
        "OpenAI-Beta": "responses=experimental",
        "accept": "text/event-stream",
        "content-type": "application/json",
        "session_id": agent.id,
    };
    const bodyJson = JSON.stringify(body);
    const MAX_RETRIES = 3;
    let res: Response | null = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (opts.signal?.aborted) throw new Error("aborted");
        try {
            res = await ctx.fns.llm.connectFetch({ url: ep.url, init: { method: "POST", headers, body: bodyJson, signal: opts.signal } });
            if (res.ok) break;
            const errText = await res.text();
            lastErr = new Error(`${ep.provider} ${res.status}: ${errText.slice(0, 500)}`);
            if (attempt >= MAX_RETRIES || !isRetryable(res.status, errText)) throw lastErr;
        } catch (e: any) {
            lastErr = e;
            if (e?.message === "aborted") throw e;
            if (attempt >= MAX_RETRIES) throw e;
            if (res && !isRetryable(res.status, e?.message ?? "")) throw e;
        }
        const delay = 1000 * 2 ** attempt; // 1s, 2s, 4s
        console.warn(`[codex] attempt ${attempt + 1}/${MAX_RETRIES + 1} failed (${lastErr?.message?.slice(0, 120)}); retrying in ${delay}ms`);
        await Bun.sleep(delay);
    }
    if (!res?.ok) throw lastErr ?? new Error("codex: failed after retries");
    if (!res.body) throw new Error("empty response body");

    let text = "";
    let thinking = "";
    let finishReason: string | null = null;
    const usage = { prompt_tokens: 0, completion_tokens: 0 };
    // The Responses API announces a call as an output ITEM and finishes it with
    // response.output_item.done — the arguments are complete there, so the
    // *.delta events only matter for showing progress.
    const toolCalls: { id: string; name: string; args: any }[] = [];

    for await (const { data } of ctx.fns.llm.parseSSE({ body: res.body })) {
        if (!data || data === "[DONE]") continue;
        let ev: any;
        try { ev = JSON.parse(data); } catch { continue; }
        const t = ev.type;
        if (t === "response.output_text.delta" && typeof ev.delta === "string") {
            text += ev.delta;
            opts.onEvent?.({ type: "text_delta", delta: ev.delta });
        } else if (t === "response.reasoning_summary_text.delta" && typeof ev.delta === "string") {
            thinking += ev.delta;
            opts.onEvent?.({ type: "thinking_delta", delta: ev.delta });
        } else if (t === "response.function_call_arguments.delta" && typeof ev.delta === "string") {
            opts.onEvent?.({ type: "tool_args_delta", delta: ev.delta, id: ev.item_id });
        } else if (t === "response.output_item.done" && ev.item?.type === "function_call") {
            toolCalls.push({ id: ev.item.call_id ?? ev.item.id, name: ev.item.name, args: parseArgs(ev.item.arguments) });
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
            const msg =
                ev.response?.error?.message ??
                ev.error?.message ??
                ev.message ??
                ev.code ??
                JSON.stringify(ev);
            throw new Error(`codex ${t}: ${msg}`);
        }
    }

    return { text, thinking, finishReason, usage, toolCalls };
}

// strict:true makes these schema-valid, but a truncated reply can still end
// mid-object. A parse failure travels as an argument the schema will reject by
// name, not as a thrown run.
function parseArgs(raw: unknown): any {
    const buf = typeof raw === "string" ? raw : "";
    if (!buf.trim()) return {};
    try { return JSON.parse(buf); } catch { return { __unparsed: buf }; }
}

function isRetryable(status: number, body: string): boolean {
    if (status === 429 || status === 408) return true;
    if (status >= 500 && status <= 599) return true;
    return /upstream\s+connect|connection\s+(?:reset|termination|refused)|service\s+unavailable|overloaded|rate.?limit/i.test(body);
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
