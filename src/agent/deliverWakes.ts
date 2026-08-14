/** Deliver wakes for the runtime.  * @param opts.now Timestamp used as the current time.
 * @param opts.limit Maximum records to process.
*/
export default async function (ctx: Context, _session: Session | null, opts?: {
        /** Now used by the operation. */
now?: number;
        /** Maximum number of results to return. */
limit?: number }): Promise<{ delivered: string[] }> {
    const now = Math.floor(opts?.now ?? Date.now());
    const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
    const rows = (await ctx.fns.procs.db.select({
        sql: `WITH due AS (
                SELECT id, wake_reason FROM agents
                 WHERE wake_at IS NOT NULL AND wake_at <= ? AND archived_at IS NULL
                 ORDER BY wake_at ASC LIMIT ? FOR UPDATE SKIP LOCKED
              ), cleared AS (
                UPDATE agents a
                   SET wake_at = NULL, wake_reason = NULL,
                       next_run_at = COALESCE(a.next_run_at, ?), updated_at = ?
                  FROM due WHERE a.id = due.id
                RETURNING a.id, due.wake_reason
              ) SELECT * FROM cleared`,
        params: [now, limit, now, now],
    })) as any[];
    const delivered: string[] = [];
    for (const row of rows) {
        const id = String(row.id);
        const reason = String(row.wake_reason ?? "Scheduled wake-up");
        const message = await ctx.fns.session.appendMessage({ id, message: {
            role: "user",
            content: `Wake-up: ${reason}`,
            message_type: "wake_up",
            excluded_from_cursor: true,
        } });
        await ctx.fns.session.appendEvent({ id, event: { type: "wake_up", reason, messageIdx: message.idx } });
        const agent = (ctx.state as any).agent?.[id];
        if (agent) {
            agent.wakeAt = null;
            agent.wakeReason = null;
            await ctx.fns.session.syncAgentState({ agent });
        }
        ctx.fns.events.refreshAgentMeta({ agentId: id, reason: "wake-delivered" });
        delivered.push(id);
    }
    if (delivered.length) ctx.fns.agent.wakeWorker({});
    return { delivered };
}
