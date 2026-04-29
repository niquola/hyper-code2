export default function (ctx: Context, id: string, from: number): { ok: boolean; from?: number; reason?: string } {
    const messages = ctx.fns.session.getMessages(ctx, id);
    if (!Number.isInteger(from) || from < 0 || from >= messages.length) return { ok: false, reason: "invalid idx" };
    let effectiveFrom = from;
    while (effectiveFrom > 0) {
        const prev = messages[effectiveFrom - 1];
        if (prev?.role === "assistant" && Array.isArray(prev.tool_calls) && prev.tool_calls.length > 0) effectiveFrom -= 1;
        else break;
    }
    ctx.fns.session.replaceMessages(ctx, id, messages.slice(0, effectiveFrom));
    return { ok: true, from: effectiveFrom };
}
