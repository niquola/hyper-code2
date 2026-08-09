export default async function (ctx: Context, _session: Session | null, opts: { id: string; event: any; ts?: number }): Promise<{ idx: number }> {
    const { id, event } = opts;
    const ts = opts.ts ?? Date.now();
    const row = ((await ctx.fns.procs.db.select({ sql: 'SELECT COALESCE(MAX(idx), -1) AS n FROM events WHERE agent_id = ?', params: [id] })) as any[])[0];
    const idx = Number(row?.n ?? -1) + 1;
    await ctx.fns.procs.db.run({ sql: 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', params: [id, idx, event.type, JSON.stringify(event), ts] });
    await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    // Wake any in-process waiters AND broadcast over SSE so browser tabs
    // showing this agent fetch the delta with a short hx-get instead of
    // holding a long-poll connection per tab.
    await ctx.fns.agent?.wakeWaiters?.({ agentId: id });
    await ctx.fns.procs.events.emit({ event: { type: 'agent.event_appended', agentId: id, idx } });
    return { idx };
}
