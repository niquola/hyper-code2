function compactResult(value: any, maxChars = 16_000): any {
    let json: string;
    try { json = JSON.stringify(value); }
    catch { return { truncated: true, preview: String(value).slice(0, maxChars) }; }
    if (json.length <= maxChars) return value;
    return { truncated: true, originalChars: json.length, preview: json.slice(0, maxChars) };
}

/** Deliver watch for the runtime.  * @param opts.watchId Conditional watch identifier.
 * @param opts.now Timestamp used as the current time.
 * @param opts.claimed Whether the watch was already claimed.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Watch identifier. */
    watchId: string;
        /** Now used by the operation. */
    now?: number;
        /** Claimed used by the operation. */
    claimed?: boolean },
): Promise<{ status: "ready" | "waiting" | "timeout" | "missing"; result?: any }> {
    const now = opts.now ?? Date.now();
    let row: any;
    if (opts.claimed) {
        row = ((await ctx.fns.procs.db.select({ sql: "SELECT * FROM agent_watches WHERE id = ? AND status = 'checking'", params: [opts.watchId] })) as any[])[0];
    } else {
        row = ((await ctx.fns.procs.db.select({
            sql: "UPDATE agent_watches SET status = 'checking' WHERE id = ? AND status = 'active' RETURNING *",
            params: [opts.watchId],
        })) as any[])[0];
    }
    if (!row) return { status: "missing" };

    const input = typeof row.opts === "string" ? JSON.parse(row.opts) : row.opts;
    let status: "ready" | "waiting" | "timeout" = now >= Number(row.timeout_at) ? "timeout" : "waiting";
    let result: any = null;
    let error: string | null = null;
    if (status !== "timeout") {
        try {
            const checked = await ctx.fns.agent.watchPredicate({ predicate: row.predicate, opts: input });
            if (checked.ready) { status = "ready"; result = compactResult(checked.result ?? true); }
        } catch (e: any) { error = String(e?.message ?? e).slice(0, 1000); }
    }
    if (status === "waiting") {
        const updated = await ctx.fns.procs.db.run({
            sql: "UPDATE agent_watches SET status = 'active', attempts = attempts + 1, last_error = ?, next_check_at = ? WHERE id = ? AND status = 'checking'",
            params: [error, now + Number(row.interval_ms), row.id],
        });
        return { status: updated.changes > 0 ? "waiting" : "missing" };
    }

    const finalStatus = status === "ready" ? "completed" : "timeout";
    const finalized = await ctx.fns.procs.db.run({
        sql: "UPDATE agent_watches SET status = ?, attempts = attempts + 1, last_error = ?, finished_at = ? WHERE id = ? AND status = 'checking'",
        params: [finalStatus, error, now, row.id],
    });
    if (finalized.changes === 0) return { status: "missing" };

    const summary = status === "ready" ? `Wake condition met: ${row.reason}` : `Wake condition timed out: ${row.reason}`;
    const body = status === "ready" ? `${summary}\n\nResult: ${JSON.stringify(result)}` : summary;
    const message = await ctx.fns.session.appendMessage({ id: row.agent_id, message: { role: "user", content: body, message_type: "wake_up", excluded_from_cursor: true } });
    await ctx.fns.session.appendEvent({ id: row.agent_id, event: { type: "wake_up", reason: row.reason, summary, result: status === "ready" ? result : null, messageIdx: message.idx, watchId: row.id, watchStatus: status } });
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET next_run_at = COALESCE(next_run_at, ?), updated_at = ? WHERE id = ?", params: [now, now, row.agent_id] });
    const agent = (ctx.state as any).agent?.[row.agent_id];
    if (agent) await ctx.fns.session.syncAgentState({ agent });
    ctx.fns.events.refreshAgentMeta({ agentId: row.agent_id, section: "wake", reason: "watch-delivered" });
    ctx.fns.agent.wakeWorker({});
    return { status, ...(status === "ready" ? { result } : {}) };
}
