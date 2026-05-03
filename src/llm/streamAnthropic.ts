// Stream from an Anthropic Messages API endpoint (anthropic.com, kimi.com/coding, etc).
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
    const ep = ctx.fns.llm.resolveEndpoint(ctx, { model: agent.model });

    // buildLlmRequest handles the claude-code anti-fraud header (kept in
    // system) and moves the rest of the instruction body into messages
    // (option A — "system-as-messages").
    const { system, messages: convo } = await ctx.fns.agent.buildLlmRequest(ctx, { agent });

    const body: any = {
        model: ep.modelId,
        system,
        messages: ctx.fns.llm.toAnthropicMessages(ctx, { messages: convo }),
        stream: true,
        max_tokens: 8192,
    };

    const headers: Record<string, string> = {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
    };
    // Subscription tokens are refreshed lazily (each has ~15min–1h TTL):
    //   kimi-coding   → ~/.kimi/credentials/kimi-code.json
    //   claude-code   → macOS keychain "Claude Code-credentials"
    let apiKey = ep.apiKey;
    if (ep.provider === "kimi-coding") {
        const fresh = await ctx.fns.llm.refreshKimiCode(ctx);
        if (fresh) apiKey = fresh;
    } else if (ep.provider === "claude-code") {
        const fresh = await ctx.fns.llm.refreshClaudeCode(ctx);
        if (fresh) apiKey = fresh;
    }
    if (apiKey) {
        if (apiKey.startsWith("sk-ant-oat") || ep.provider === "kimi-coding") {
            headers["authorization"] = `Bearer ${apiKey}`;
        } else {
            headers["x-api-key"] = apiKey;
        }
    }
    // Claude Code subscription requires identity headers that match what the
    // official `claude` CLI sends; otherwise the OAuth token is rejected or
    // the request gets flagged. Headers below mirror the CLI 2.1.x reverse-
    // engineering. Subject to change — every value is env-overridable.
    if (ep.provider === "claude-code") {
        const cliVersion = ctx.env.CLAUDE_CODE_CLI_VERSION ?? "2.1.126";
        const baseBeta = ["oauth-2025-04-20", "interleaved-thinking-2025-05-14", "prompt-caching-scope-2026-01-05"];
        headers["anthropic-beta"] = ctx.env.CLAUDE_CODE_ANTHROPIC_BETA ?? baseBeta.join(",");
        headers["user-agent"] = ctx.env.CLAUDE_CODE_USER_AGENT ?? `claude-cli/${cliVersion} (external, sdk-cli)`;
        headers["x-app"] = "cli";
        headers["anthropic-dangerous-direct-browser-access"] = "true";
        headers["x-client-request-id"] = (globalThis as any).crypto?.randomUUID?.() ?? Bun.randomUUIDv7();
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
    let finishReason: string | null = null;
    let usage: any = { prompt_tokens: 0, completion_tokens: 0 };

    for await (const ev of parseSSE(res.body)) {
        if (ev.type === "message_start") {
            const u = ev.data.message?.usage;
            if (u) usage.prompt_tokens = u.input_tokens ?? 0;
        } else if (ev.type === "content_block_delta") {
            const d = ev.data.delta ?? {};
            if (d.type === "text_delta" && typeof d.text === "string") {
                text += d.text;
                opts.onEvent?.({ type: "text_delta", delta: d.text });
            } else if (d.type === "thinking_delta" && typeof d.thinking === "string") {
                thinking += d.thinking;
                opts.onEvent?.({ type: "thinking_delta", delta: d.thinking });
            }
        } else if (ev.type === "message_delta") {
            if (ev.data.delta?.stop_reason) finishReason = ev.data.delta.stop_reason;
            if (ev.data.usage?.output_tokens != null) usage.completion_tokens = ev.data.usage.output_tokens;
        }
    }

    return { text, thinking, finishReason: mapStop(finishReason), usage };
}

function mapStop(r: string | null): string | null {
    if (!r) return null;
    if (r === "end_turn" || r === "stop_sequence") return "stop";
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
