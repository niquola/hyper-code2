/** Archive for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string }): Promise<{ ok: boolean }> {
    const { id } = opts;
    const res = await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET archived_at = ? WHERE id = ?', params: [Date.now(), id] });
    const ok = res.changes > 0;
    if (ok) await ctx.fns.events.emitAgentsChanged({ agentId: id, reason: 'archive' });
    return { ok };
}
