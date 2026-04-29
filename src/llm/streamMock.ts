export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    _opts: { signal?: AbortSignal; onEvent?: (ev: any) => void } = {},
): Promise<{
    text: string;
    thinking: string;
    toolCalls: Array<{ id: string; name: string; arguments: string }>;
    finishReason: string | null;
    usage: any;
}> {
    const messages = agent.parentId ? ctx.fns.session.getFullMessages(ctx, agent.id) : (agent.messages ?? []);
    const last = messages[messages.length - 1] ?? null;
    const cfg = agent.scratchpad.mockLLM ?? {};

    if (last?.role === "user" && cfg.userToolCode) {
        return {
            text: "",
            thinking: "",
            toolCalls: [{ id: "mock_tool_1", name: "evalCode", arguments: JSON.stringify({ code: cfg.userToolCode }) }],
            finishReason: "tool_calls",
            usage: { prompt_tokens: messages.length, total_tokens: messages.length },
        };
    }

    if (last?.role === "tool") {
        return {
            text: String(cfg.afterToolText ?? last.content ?? "ok"),
            thinking: "",
            toolCalls: [],
            finishReason: "stop",
            usage: { prompt_tokens: messages.length, total_tokens: messages.length + 1 },
        };
    }

    if (last?.role === "user") {
        if (cfg.echoUser) {
            return {
                text: String(last.content ?? ""),
                thinking: "",
                toolCalls: [],
                finishReason: "stop",
                usage: { prompt_tokens: messages.length, total_tokens: messages.length + 1 },
            };
        }
        return {
            text: String(cfg.userText ?? "ok"),
            thinking: "",
            toolCalls: [],
            finishReason: "stop",
            usage: { prompt_tokens: messages.length, total_tokens: messages.length + 1 },
        };
    }

    return {
        text: String(cfg.defaultText ?? "ok"),
        thinking: "",
        toolCalls: [],
        finishReason: "stop",
        usage: { prompt_tokens: messages.length, total_tokens: messages.length + 1 },
    };
}
