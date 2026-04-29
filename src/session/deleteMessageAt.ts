export default function (ctx: Context, id: string, idx: number): { ok: boolean; reason?: string } {
    const messages = ctx.fns.session.getMessages(ctx, id);
    if (!Number.isInteger(idx) || idx < 0 || idx >= messages.length) return { ok: false, reason: "invalid idx" };
    const target = messages[idx];
    if (!target) return { ok: false, reason: "not found" };
    if (target.role === "tool") return { ok: false, reason: "cannot delete tool message alone; use delete from here" };
    if (target.role === "assistant" && Array.isArray(target.tool_calls) && target.tool_calls.length > 0) return { ok: false, reason: "cannot delete assistant tool-call message alone; use delete from here" };
    const next = messages.slice(0, idx).concat(messages.slice(idx + 1));
    ctx.fns.session.replaceMessages(ctx, id, next);
    return { ok: true };
}
