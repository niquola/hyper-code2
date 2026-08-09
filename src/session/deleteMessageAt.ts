// Delete a single message by its DB idx, plus the UI event(s) that render it,
// so the chat bubble actually disappears (the UI is driven by the events
// table). Refuses to delete one half of a marker pair (would strand the other
// half) — for those use truncateMessagesFrom, which walks the pair boundary.
//
// `idx` is a DB message idx (what the delete button posts as messageIdx), NOT
// an array position. We delete by idx directly — no getMessages →
// replaceMessages round-trip — so surviving rows keep their idx and flags and
// stay aligned with their events. The resulting idx gap is harmless (reads are
// ORDER BY idx, appends use MAX(idx)+1). Marker format lives in one place —
// ctx.fns.agent.markerKind.
export default function (ctx: Context, _session: Session | null, opts: { id: string; idx: number }): { ok: boolean; reason?: string } {
    const { id, idx } = opts;
    if (!Number.isInteger(idx) || idx < 0) return { ok: false, reason: "invalid idx" };

    const target = (ctx.fns.procs.db.select({
        sql: "SELECT idx, role, content FROM messages WHERE agent_id = ? AND idx = ?",
        params: [id, idx],
    }) as any[])[0];
    if (!target) return { ok: false, reason: "not found" };
    const kind = ctx.fns.agent.markerKind({ content: target.content });
    if (target.role === "assistant" && kind === "invocation") {
        return { ok: false, reason: "cannot delete assistant marker message alone; use delete from here" };
    }
    if (target.role === "user" && kind === "result") {
        return { ok: false, reason: "cannot delete tool-result message alone; use delete from here" };
    }

    ctx.fns.procs.db.run({ sql: "DELETE FROM messages WHERE agent_id = ? AND idx = ?", params: [id, idx] });

    // Remove the event(s) that render this exact message (user / assistant
    // bubbles carry messageIdx). Leaves surrounding events untouched.
    const evRows = ctx.fns.procs.db.select({
        sql: "SELECT idx, payload FROM events WHERE agent_id = ? ORDER BY idx",
        params: [id],
    }) as any[];
    for (const e of evRows) {
        let mi: any;
        try { mi = JSON.parse(e.payload)?.messageIdx; } catch { mi = undefined; }
        if (mi != null && Number(mi) === idx) {
            ctx.fns.procs.db.run({ sql: "DELETE FROM events WHERE agent_id = ? AND idx = ?", params: [id, Number(e.idx)] });
        }
    }

    return { ok: true };
}
