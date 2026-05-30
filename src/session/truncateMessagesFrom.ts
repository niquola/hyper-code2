// Drop messages at DB idx >= `from` (inclusive) AND the UI events that render
// them, so "delete from here" actually clears the chat bubbles (the UI is
// driven by the events table, not messages) and the LLM transcript together.
//
// `from` is a DB message idx (what the delete button posts as messageIdx),
// NOT an array position. We delete by idx directly — no getMessages →
// replaceMessages round-trip — so surviving rows keep their idx, their
// excluded_from_cursor / excluded_from_llm flags, and stay aligned with their
// events. Renumbering would strand every event.messageIdx.
//
// Walks back if `from` lands inside a marker pair so we never leave half a pair:
// assistant §eval / §write:<path> / §bash / §html → user §result:* / §error:*.
// Marker format lives in one place — ctx.fns.agent.markerKind.
export default function (ctx: Context, opts: { id: string; from: number }): { ok: boolean; from?: number; reason?: string } {
    const { id, from } = opts;
    if (!Number.isInteger(from) || from < 0) return { ok: false, reason: "invalid idx" };

    const rows = ctx.fns.db.select<any>(ctx, {
        sql: "SELECT idx, role, content FROM messages WHERE agent_id = ? ORDER BY idx",
        params: [id],
    });
    // First to-be-deleted row at or after `from` (robust to idx gaps).
    let p = rows.findIndex((r: any) => Number(r.idx) >= from);
    if (p < 0) return { ok: false, reason: "invalid idx" };

    // Walk back over a marker pair boundary.
    while (p > 0) {
        const cur = rows[p];
        const prev = rows[p - 1];
        const curIsResult = cur.role === "user" && ctx.fns.agent.markerKind(ctx, { content: cur.content }) === "result";
        const prevIsInvocation = ctx.fns.agent.markerKind(ctx, { content: prev.content }) === "invocation";
        if (curIsResult || prevIsInvocation) p -= 1;
        else break;
    }
    const effectiveFrom = Number(rows[p].idx);

    ctx.fns.db.exec(ctx, { sql: "DELETE FROM messages WHERE agent_id = ? AND idx >= ?", params: [id, effectiveFrom] });

    // Truncate events at the matching visual boundary: the earliest event that
    // belongs to a message >= effectiveFrom. Everything after it (later
    // tool_call / thinking / error events that carry no messageIdx) shares a
    // higher event idx and is removed too.
    const evRows = ctx.fns.db.select<any>(ctx, {
        sql: "SELECT idx, payload FROM events WHERE agent_id = ? ORDER BY idx",
        params: [id],
    });
    let boundaryEventIdx: number | null = null;
    for (const e of evRows) {
        let mi: any;
        try { mi = JSON.parse(e.payload)?.messageIdx; } catch { mi = undefined; }
        if (mi != null && Number(mi) >= effectiveFrom) { boundaryEventIdx = Number(e.idx); break; }
    }
    if (boundaryEventIdx != null) {
        ctx.fns.db.exec(ctx, { sql: "DELETE FROM events WHERE agent_id = ? AND idx >= ?", params: [id, boundaryEventIdx] });
    }

    return { ok: true, from: effectiveFrom };
}
