// Delete a single message by idx. Refuses to delete one half of a marker
// pair (would leave the other half stranded). For those cases the caller
// should use truncateMessagesFrom, which walks the pair boundary.
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

export default function (ctx: Context, opts: { id: string; idx: number }): { ok: boolean; reason?: string } {
    const { id, idx } = opts;
    const messages = ctx.fns.session.getMessages(ctx, { id });
    if (!Number.isInteger(idx) || idx < 0 || idx >= messages.length) return { ok: false, reason: "invalid idx" };
    const target = messages[idx];
    if (!target) return { ok: false, reason: "not found" };
    if (isAssistantInvocation(target)) {
        return { ok: false, reason: "cannot delete assistant marker message alone; use delete from here" };
    }
    if (isToolResult(target)) {
        return { ok: false, reason: "cannot delete tool-result message alone; use delete from here" };
    }
    const next = messages.slice(0, idx).concat(messages.slice(idx + 1));
    ctx.fns.session.replaceMessages(ctx, { id, messages: next });
    return { ok: true };
}
