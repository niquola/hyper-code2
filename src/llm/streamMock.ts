export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    _opts: { signal?: AbortSignal; onEvent?: (ev: any) => void } = {},
): Promise<{
    text: string;
    thinking: string;
    finishReason: string | null;
    usage: any;
}> {
    const messages = agent.parentId ? ctx.fns.session.getFullMessages(ctx, agent.id) : (agent.messages ?? []);
    const last = messages[messages.length - 1] ?? null;
    const cfg = agent.scratchpad.mockLLM ?? {};
    const usage = { prompt_tokens: messages.length, total_tokens: messages.length + 1 };

    if (last?.role === "user") {
        const text = cfg.echoUser ? String(last.content ?? "") : String(cfg.userText ?? "ok");
        return { text, thinking: "", finishReason: "stop", usage };
    }

    return { text: String(cfg.defaultText ?? "ok"), thinking: "", finishReason: "stop", usage };
}
