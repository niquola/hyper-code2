/** Sleep idle for the runtime.  * @param opts.idleMs Minimum idle duration in milliseconds.
 * @param opts.minMessages Minimum transcript size before compaction.
 * @param opts.limit Maximum records to process.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Idle ms used by the operation. */
    idleMs?: number;
        /** Min messages used by the operation. */
    minMessages?: number;
        /** Maximum number of results to return. */
    limit?: number },
): Promise<{ started: string[] }> {
    const idleMs = Math.max(60_000, opts.idleMs ?? 15 * 60_000);
    const minMessages = Math.max(4, opts.minMessages ?? 20);
    const rows = (await ctx.fns.procs.db.select({
        sql: `SELECT a.id
                FROM agents a
               WHERE a.archived_at IS NULL AND a.run_state = 'idle' AND a.next_run_at IS NULL
                 AND a.parent_id IS NULL AND a.updated_at < ?
                 AND (SELECT COUNT(*) FROM messages m WHERE m.agent_id = a.id) >= ?
                 AND a.sleep_enabled = TRUE
                 AND COALESCE(
                       (SELECT MAX((g->>'sourceOffset')::int) FROM jsonb_array_elements(COALESCE(a.sleep_context->'generations', '[]'::jsonb)) g),
                       (a.sleep_context->>'sourceOffset')::int,
                       0
                     ) <
                     (SELECT COUNT(*) FROM messages m WHERE m.agent_id = a.id)
               ORDER BY a.updated_at ASC LIMIT ?`,
        params: [Date.now() - idleMs, minMessages, Math.max(1, Math.min(10, opts.limit ?? 2))],
    })) as any[];
    const started: string[] = [];
    for (const row of rows) {
        const agent = (ctx.state as any).agent?.[row.id] ?? await ctx.fns.session.load({ id: row.id });
        if (!agent) continue;
        const result = await ctx.fns.agent.sleep({ agent, minMessages });
        if (result.started) started.push(row.id);
    }
    return { started };
}
