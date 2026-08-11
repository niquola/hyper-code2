export default async function (ctx: Context, _session: Session | null, opts: { id: string; event: any; ts?: number }): Promise<{ idx: number }> {
    const { id, event } = opts;
    const ts = opts.ts ?? Date.now();
    // idx is allocated IN the insert (one statement, RETURNING) and retried on
    // a duplicate: a separate SELECT MAX + INSERT lost the race whenever two
    // appends overlapped — the stop button's error event against the running
    // turn's tool events was the reproducer.
    const payload = JSON.stringify(event).replaceAll('\u0000', '\uFFFD');
    let idx = -1;
    for (let attempt = 0; ; attempt++) {
        try {
            const res = await ctx.fns.procs.db.run({
                sql: `INSERT INTO events (agent_id, idx, type, payload, ts)
                      SELECT ?, COALESCE(MAX(idx), -1) + 1, ?, ?, ? FROM events WHERE agent_id = ?
                      RETURNING idx`,
                params: [id, event.type, payload, ts, id],
            });
            idx = Number((res.rows as any[])?.[0]?.idx ?? -1);
            break;
        } catch (e: any) {
            if (attempt >= 9 || !/duplicate key|events_pkey/i.test(String(e?.message ?? e))) throw e;
            // Jittered backoff: a simultaneous burst all reads the same MAX —
            // without a pause the retries collide in lockstep too.
            await new Promise(r => setTimeout(r, 3 + Math.random() * 20 * (attempt + 1)));
        }
    }
    await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    // Wake any in-process waiters AND broadcast over SSE so browser tabs
    // showing this agent fetch the delta with a short hx-get instead of
    // holding a long-poll connection per tab.
    await ctx.fns.agent?.wakeWaiters?.({ agentId: id });
    await ctx.fns.procs.events.emit({ event: { type: 'agent.event_appended', agentId: id, idx } });
    return { idx };
}
