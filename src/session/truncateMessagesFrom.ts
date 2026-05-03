// Drop messages[from..] (inclusive). Walks back if `from` lands inside
// a marker pair so we never leave half a pair in the transcript:
// assistant §eval / §write:<path> / §html → user §result:* / §error:*.
// Returns {ok, from} with `from` = effective truncation index post-walkback.
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

export default function (ctx: Context, opts: { id: string; from: number }): { ok: boolean; from?: number; reason?: string } {
    const { id, from } = opts;
    const messages = ctx.fns.session.getMessages(ctx, { id });
    if (!Number.isInteger(from) || from < 0 || from >= messages.length) return { ok: false, reason: "invalid idx" };
    let effectiveFrom = from;
    while (effectiveFrom > 0) {
        const cur = messages[effectiveFrom];
        const prev = messages[effectiveFrom - 1];
        if (isToolResult(cur) || isAssistantInvocation(prev)) effectiveFrom -= 1;
        else break;
    }
    ctx.fns.session.replaceMessages(ctx, { id, messages: messages.slice(0, effectiveFrom) });
    return { ok: true, from: effectiveFrom };
}
