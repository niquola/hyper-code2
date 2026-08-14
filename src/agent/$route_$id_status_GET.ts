/** Handles the id status get HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    const row = ((await ctx.fns.procs.db.select({
        sql: 'SELECT id, model, run_state, run_started_at, next_run_at, last_processed_msg_idx, last_error FROM agents WHERE id = ?',
        params: [id],
    })) as any[])[0];
    if (!row) return Response.json({ error: 'not found' }, { status: 404 });

    const now = Date.now();
    return Response.json({
        agent: {
            id: row.id,
            model: row.model,
            runState: row.run_state,
            runStartedAt: row.run_started_at,
            nextRunAt: row.next_run_at,
            lastProcessedMsgIdx: row.last_processed_msg_idx,
            lastError: row.last_error,
            waitingMs: row.run_state === 'idle' && row.next_run_at
                ? Math.max(0, Number(row.next_run_at) - now)
                : 0,
            elapsedMs: row.run_state === 'running' && row.run_started_at
                ? now - Number(row.run_started_at)
                : 0,
        },
    });
}
