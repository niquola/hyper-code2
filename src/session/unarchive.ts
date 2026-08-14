// Put an archived agent back on the rail. The mirror of archive.ts: one
// column, NULLed — the transcript never went anywhere.
/** Unarchive for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string }): Promise<{ ok: boolean }> {
    const { id } = opts;
    const res = await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET archived_at = NULL WHERE id = ?', params: [id] });
    const ok = res.changes > 0;
    if (ok) await ctx.fns.events.emitAgentsChanged({ agentId: id, reason: 'unarchive' });
    return { ok };
}
