// The stand-in provider every test runs on (`model: "mock:*"`).
//
// Two ways to drive it, both through agent.scratchpad.mockLLM:
//   { echoUser: true } | { userText, defaultText }   — plain text replies
//   { turns: [{ text?, toolCalls: [{ name, args }] }, …] }
//        — one entry consumed per call, so a JSON-protocol loop can be scripted
//          end to end: call a tool, see the result, then answer in prose. Ids
//          are generated per turn, which is what pairs a result to its call.
/** Performs the llm.streamMock runtime operation. */
/**
 * The stand-in provider every test runs on (`model: "mock:*"`).
 * @param opts.agent Agent associated with the operation.
 * @param opts.signal Abort signal for cancelling the request.
 * @param opts.onEvent Callback invoked for each normalized stream event.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent associated with the operation. */ agent: types.agent.Agent;
        /** Abort signal for cancelling the operation. */ signal?: AbortSignal;
        /** Callback invoked for each streamed model event. */ onEvent?: (ev: any) => void },
): Promise<{
    text: string;
    thinking: string;
    finishReason: string | null;
    usage: any;
    toolCalls: { id: string; name: string; args: any }[];
}> {
    const { agent } = opts;
    const messages = agent.parentId ? await ctx.fns.session.getFullMessages({ id: agent.id }) : (agent.messages ?? []);
    const last = messages[messages.length - 1] ?? null;
    const cfg = agent.scratchpad.mockLLM ?? {};
    const usage = { prompt_tokens: messages.length, total_tokens: messages.length + 1 };

    if (Array.isArray(cfg.turns)) {
        const n = Number(agent.scratchpad.mockTurn ?? 0);
        agent.scratchpad.mockTurn = n + 1;
        const turn = cfg.turns[n];
        if (turn) {
            const calls = (turn.toolCalls ?? []).map((c: any, i: number) => ({
                id: c.id ?? `call_${n}_${i}`,
                name: c.name,
                args: c.args ?? {},
            }));
            return {
                text: String(turn.text ?? ""),
                thinking: "",
                finishReason: calls.length ? "tool_calls" : "stop",
                usage,
                toolCalls: calls,
            };
        }
        return { text: String(cfg.defaultText ?? "done"), thinking: "", finishReason: "stop", usage, toolCalls: [] };
    }

    if (last?.role === "user") {
        const text = cfg.echoUser ? String(last.content ?? "") : String(cfg.userText ?? "ok");
        return { text, thinking: "", finishReason: "stop", usage, toolCalls: [] };
    }

    return { text: String(cfg.defaultText ?? "ok"), thinking: "", finishReason: "stop", usage, toolCalls: [] };
}
