export default function (
    _ctx: Context,
    agent: types.agent.Agent,
    arg: string | { message: number; summary: string },
): { replaced: boolean; from?: number; before?: number; after?: number; toolCallId?: string } {
    // Overload A: compact({message: id, summary}) — drop agent.messages[id..] and insert a
    // single synthetic user note. If the preceding message is an assistant with unanswered
    // tool_calls, trim further back to keep the chat protocol valid.
    if (typeof arg === "object" && arg !== null) {
        const { message: from, summary } = arg;
        if (!Number.isInteger(from) || from < 0 || from >= agent.messages.length) {
            return { replaced: false };
        }
        let effectiveFrom = from;
        while (effectiveFrom > 0) {
            const prev = agent.messages[effectiveFrom - 1];
            if (prev.role === "assistant" && Array.isArray(prev.tool_calls) && prev.tool_calls.length > 0) {
                effectiveFrom -= 1;
            } else {
                break;
            }
        }
        const dropped = agent.messages.slice(effectiveFrom);
        const before = dropped.reduce((n, m) => n + JSON.stringify(m).length, 0);
        const note = `[compacted from #${effectiveFrom}, ${dropped.length} msg(s)] ${summary}`;
        agent.messages = agent.messages.slice(0, effectiveFrom);
        agent.messages.push({ role: "user", content: note });
        return { replaced: true, from: effectiveFrom, before, after: note.length };
    }

    // Overload B: compact("summary") — replace just the last `tool` message in place.
    const summary = String(arg);
    for (let i = agent.messages.length - 1; i >= 0; i--) {
        const m = agent.messages[i];
        if (m.role !== "tool") continue;
        const before = String(m.content ?? "").length;
        const newContent = `[compacted] ${summary}`;
        m.content = newContent;
        return { replaced: true, toolCallId: m.tool_call_id, before, after: newContent.length };
    }
    return { replaced: false };
}
