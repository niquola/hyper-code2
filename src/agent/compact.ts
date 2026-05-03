// Two operations available to the agent for shrinking transcript context:
// 1. compact(ctx, { agent, summary: "summary string" })
//    Find the most recent §result:* / §error:* synthetic user-message
//    and replace its content with a "[compacted] <summary>" note. Loses the
//    verbose tool output but keeps the call→result chain intact for the LLM.
// 2. compact(ctx, { agent, message: <idx>, summary: "..." })
//    Drop messages[<idx>..] and replace with one synthetic user note. If
//    <idx> lands inside a marker pair, walks back over the pair so we never
//    leave half a pair stranded — same invariant as truncateMessagesFrom.
function isAssistantInvocation(m: any): boolean {
    if (m?.role !== "assistant") return false;
    const c = String(m.content ?? "");
    return c.startsWith("§eval\n") || c === "§eval"
        || c.startsWith("§write:")
        || c.startsWith("§bash\n") || c === "§bash"
        || c.startsWith("§html\n") || c === "§html";
}
function isToolResult(m: any): boolean {
    if (m?.role !== "user") return false;
    const c = String(m.content ?? "");
    return c.startsWith("§result:") || c.startsWith("§error:");
}

export default function (
    ctx: Context,
    opts: { agent: types.agent.Agent; summary: string; message?: number },
): { replaced: boolean; from?: number; before?: number; after?: number; resultIdx?: number } {
    const { agent, summary: summaryRaw, message: from } = opts;
    ctx.fns?.session?.syncAgentState?.(ctx, { agent });

    if (Number.isInteger(from)) {
        const idx = from as number;
        if (idx < 0 || idx >= agent.messages.length) {
            return { replaced: false };
        }
        let effectiveFrom = idx;
        while (effectiveFrom > 0) {
            const cur = agent.messages[effectiveFrom];
            const prev = agent.messages[effectiveFrom - 1];
            if (isToolResult(cur) || isAssistantInvocation(prev)) effectiveFrom -= 1;
            else break;
        }
        const dropped = agent.messages.slice(effectiveFrom);
        const before = dropped.reduce((n, m) => n + JSON.stringify(m).length, 0);
        const note = `[compacted from #${effectiveFrom}, ${dropped.length} msg(s)] ${summaryRaw}`;
        const next = agent.messages.slice(0, effectiveFrom);
        next.push({ role: "user", content: note });
        ctx.fns?.session?.replaceMessages?.(ctx, { id: agent.id, messages: next });
        ctx.fns?.session?.syncAgentState?.(ctx, { agent });
        return { replaced: true, from: effectiveFrom, before, after: note.length };
    }

    // String form: shrink the most recent tool-result message in place.
    const summary = String(summaryRaw);
    for (let i = agent.messages.length - 1; i >= 0; i--) {
        const m = agent.messages[i];
        if (!isToolResult(m)) continue;
        const before = String(m.content ?? "").length;
        const newContent = `[compacted] ${summary}`;
        const next = agent.messages.slice();
        next[i] = { ...m, content: newContent };
        ctx.fns?.session?.replaceMessages?.(ctx, { id: agent.id, messages: next });
        ctx.fns?.session?.syncAgentState?.(ctx, { agent });
        return { replaced: true, resultIdx: i, before, after: newContent.length };
    }
    return { replaced: false };
}
