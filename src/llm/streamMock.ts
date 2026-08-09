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
    const messages = agent.parentId ? await ctx.fns.session.getFullMessages({ id: agent.id }) : (agent.messages ?? []);
    const last = messages[messages.length - 1] ?? null;
    const cfg = agent.scratchpad.mockLLM ?? {};
    const usage = { prompt_tokens: messages.length, total_tokens: messages.length + 1 };

    if (last?.role === "user") {
        const text = cfg.echoUser ? String(last.content ?? "") : String(cfg.userText ?? "ok");
        return { text, thinking: "", finishReason: "stop", usage };
    }

    return { text: String(cfg.defaultText ?? "ok"), thinking: "", finishReason: "stop", usage };
}
