export default function (
    ctx: Context,
    agent: types.agent.Agent,
    arg: string | { message: number; summary: string },
): { replaced: boolean; from?: number; before?: number; after?: number; toolCallId?: string } {
    ctx.fns?.session?.syncAgentState?.(ctx, agent);

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
        const next = agent.messages.slice(0, effectiveFrom);
        next.push({ role: "user", content: note });
        ctx.fns?.session?.replaceMessages?.(ctx, agent.id, next);
        ctx.fns?.session?.syncAgentState?.(ctx, agent);
        return { replaced: true, from: effectiveFrom, before, after: note.length };
    }

    const summary = String(arg);
    for (let i = agent.messages.length - 1; i >= 0; i--) {
        const m = agent.messages[i];
        if (m.role !== "tool") continue;
        const before = String(m.content ?? "").length;
        const newContent = `[compacted] ${summary}`;
        const next = agent.messages.slice();
        next[i] = { ...m, content: newContent };
        ctx.fns?.session?.replaceMessages?.(ctx, agent.id, next);
        ctx.fns?.session?.syncAgentState?.(ctx, agent);
        return { replaced: true, toolCallId: m.tool_call_id, before, after: newContent.length };
    }
    return { replaced: false };
}
