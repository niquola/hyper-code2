/**
 * Executes one non-tool LLM request through any configured provider. Supports
 * Codex subscription Responses API, OpenAI-compatible APIs, Anthropic, and mock.
 * Use for runtime synthesis that is not an agent turn.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** User message content. */
        user: string;
        /** Optional system instruction. */
        system?: string;
        /** Provider-qualified model; defaults to the configured model. */
        model?: string;
        /** Sampling temperature where supported. */
        temperature?: number;
        /** Maximum output tokens. */
        max_tokens?: number;
        /** OpenAI-style response format, including `json_schema`. */
        response_format?: any;
        /** Stable request/session identifier for subscription providers. */
        sessionId?: string;
    },
): Promise<{ text: string; finishReason: string | null; usage: any; raw: any }> {
    const user = String(opts.user ?? "").trim();
    if (!user) throw new Error("llm.call: user is required");
    const model = String(opts.model ?? await ctx.fns.settings.modelDefault({})).trim();
    if (!model) throw new Error("llm.call: model is required");
    const system = String(opts.system ?? "").trim();
    const endpoint = await ctx.fns.llm.resolveEndpoint({ model });

    if (endpoint.api === "mock") return normalizeStructured({ text: user, finishReason: "stop", usage: null, raw: { mock: true } }, opts.response_format);
    const result = endpoint.api === "responses" ? await responses(ctx, endpoint, { ...opts, user, system })
        : endpoint.api === "anthropic" ? await anthropic(ctx, endpoint, { ...opts, user, system })
            : await openAI(endpoint, { ...opts, user, system });
    return normalizeStructured(result, opts.response_format);
}

async function responses(ctx: Context, endpoint: any, opts: any) {
    const token = await ctx.fns.llm.refreshCodex({ account: endpoint.account }) ?? endpoint.apiKey;
    if (!token) throw new Error("codex: no access_token");
    const body: any = {
        model: endpoint.modelId,
        store: false,
        stream: true,
        instructions: opts.system || "You are a helpful assistant.",
        input: [{ type: "message", role: "user", content: [{ type: "input_text", text: opts.user }] }],
        text: { verbosity: "low" },
    };
    const format = responsesFormat(opts.response_format);
    if (format) body.text.format = format;
    // ChatGPT Codex backend controls output limits; max_output_tokens is not accepted.
    if (opts.temperature != null) body.temperature = opts.temperature;
    const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "chatgpt-account-id": accountId(token),
            originator: "codex_cli_rs",
            "OpenAI-Beta": "responses=experimental",
            "content-type": "application/json",
            session_id: opts.sessionId || Bun.randomUUIDv7(),
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${endpoint.provider} ${response.status}: ${await response.text()}`);
    const raw: any = await readResponsesSSE(response);
    return { text: responseText(raw), finishReason: raw.status === "completed" ? "stop" : raw.status ?? null, usage: raw.usage, raw };
}

async function openAI(endpoint: any, opts: any) {
    const messages = [...(opts.system ? [{ role: "system", content: opts.system }] : []), { role: "user", content: opts.user }];
    const body: any = { model: endpoint.modelId, messages, stream: false };
    if (opts.temperature != null) body.temperature = opts.temperature;
    if (opts.max_tokens != null) body.max_tokens = opts.max_tokens;
    if (opts.response_format != null) body.response_format = opts.response_format;
    const response = await fetch(endpoint.url, { method: "POST", headers: { "content-type": "application/json", ...(endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : {}) }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`${endpoint.provider} ${response.status}: ${await response.text()}`);
    const raw: any = await response.json();
    const choice = raw?.choices?.[0] ?? {};
    return { text: String(choice?.message?.content ?? ""), finishReason: choice?.finish_reason ?? null, usage: raw?.usage, raw };
}

async function anthropic(ctx: Context, endpoint: any, opts: any) {
    let apiKey = endpoint.apiKey;
    const headers: Record<string, string> = { "content-type": "application/json", "anthropic-version": "2023-06-01" };
    if (endpoint.provider === "kimi-coding") {
        apiKey = await ctx.fns.llm.refreshKimiCode({ account: endpoint.account }) ?? apiKey;
    } else if (endpoint.provider === "claude-code") {
        apiKey = await ctx.fns.llm.refreshClaudeCode({ account: endpoint.account }) ?? apiKey;
    } else if (endpoint.provider === "anthropic-oauth") {
        apiKey = await ctx.fns.llm.getAnthropicOAuthToken({ account: endpoint.account });
    }
    const subscription = endpoint.provider === "claude-code" || endpoint.provider === "anthropic-oauth";
    if (apiKey) {
        if (subscription || endpoint.provider === "kimi-coding") headers.authorization = `Bearer ${apiKey}`;
        else headers["x-api-key"] = apiKey;
    }
    if (subscription) {
        const version = ctx.env.CLAUDE_CODE_CLI_VERSION ?? "2.1.126";
        headers["anthropic-beta"] = ctx.env.CLAUDE_CODE_ANTHROPIC_BETA ?? ["claude-code-20250219", "oauth-2025-04-20", "fine-grained-tool-streaming-2025-05-14", "interleaved-thinking-2025-05-14"].join(",");
        headers["user-agent"] = ctx.env.CLAUDE_CODE_USER_AGENT ?? `claude-cli/${version} (external, sdk-cli)`;
        headers["x-app"] = "cli";
        headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    if (!apiKey) throw new Error(`${endpoint.provider}: no credentials`);
    const body: any = { model: endpoint.modelId, max_tokens: opts.max_tokens ?? 2048, messages: [{ role: "user", content: opts.user }] };
    if (opts.system) body.system = opts.system;
    if (opts.temperature != null) body.temperature = opts.temperature;
    let response = await fetch(endpoint.url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) {
        // Newer Anthropic models reject `temperature` outright (400 "deprecated
        // for this model"). Every internal caller — reflection, sleep, compact
        // — passes a low temperature for determinism, so the whole background
        // machinery died on those models. Drop the knob and ask once more.
        const detail = await response.text();
        if (response.status === 400 && body.temperature != null && /temperature/i.test(detail) && /deprecat|not support|unsupported/i.test(detail)) {
            delete body.temperature;
            response = await fetch(endpoint.url, { method: "POST", headers, body: JSON.stringify(body) });
            if (!response.ok) throw new Error(`${endpoint.provider} ${response.status}: ${await response.text()}`);
        } else throw new Error(`${endpoint.provider} ${response.status}: ${detail}`);
    }
    const raw: any = await response.json();
    return { text: (raw.content ?? []).filter((x: any) => x.type === "text").map((x: any) => x.text).join(""), finishReason: raw.stop_reason ?? null, usage: raw.usage, raw };
}

async function readResponsesSSE(response: Response): Promise<any> {
    if (!response.body) throw new Error("codex: empty response body");
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated: any = null;
    for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n").trim();
            if (!data || data === "[DONE]") continue;
            let event: any; try { event = JSON.parse(data); } catch { continue; }
            if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
                accumulated ??= { output: [{ type: "message", content: [{ type: "output_text", text: "" }] }] };
                accumulated.output[0].content[0].text += event.delta;
            }
            if (["response.completed", "response.incomplete", "response.failed"].includes(event.type)) {
                const final = event.response ?? {};
                if (accumulated?.output?.[0]?.content?.[0]?.text && !final.output?.length) final.output = accumulated.output;
                return final;
            }
        }
    }
    return accumulated ?? {};
}


function normalizeStructured(result: { text: string; finishReason: string | null; usage: any; raw: any }, format: any) {
    if (!format) return result;
    const cleaned = String(result.text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let value: any;
    try { value = JSON.parse(cleaned); } catch { throw new Error("llm.call: provider returned invalid structured JSON"); }
    const schema = format?.type === "json_schema" ? (format.json_schema?.schema ?? format.schema) : null;
    if (schema) {
        if (schema.type === "object" && (!value || Array.isArray(value) || typeof value !== "object")) throw new Error("llm.call: structured response is not an object");
        for (const key of schema.required ?? []) if (!(key in value)) throw new Error(`llm.call: structured response missing ${key}`);
        if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) throw new Error(`llm.call: structured response has unknown property ${key}`);
    }
    return { ...result, text: JSON.stringify(value) };
}


function responsesFormat(format: any): any {
    if (!format) return null;
    if (format.type === "json_schema") {
        const value = format.json_schema ?? format;
        return { type: "json_schema", name: value.name ?? "response", strict: value.strict ?? true, schema: value.schema };
    }
    return format.type === "json_object" ? { type: "json_object" } : null;
}
function responseText(raw: any): string {
    if (typeof raw?.output_text === "string") return raw.output_text;
    return (raw?.output ?? []).flatMap((item: any) => item?.content ?? []).map((block: any) => block?.text ?? block?.output_text ?? "").join("");
}
function accountId(token: string): string {
    try { const payload = JSON.parse(Buffer.from(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()); return payload?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? ""; } catch { return ""; }
}
