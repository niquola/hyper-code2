/** Delete for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string }): Promise<{ ok: boolean }> {
    const { id } = opts;
    const res = await ctx.fns.procs.db.run({ sql: "DELETE FROM agents WHERE id = ?", params: [id] });
    const removed = res.changes > 0;
    if (removed) {
        await ctx.fns.procs.db.run({ sql: "DELETE FROM messages WHERE agent_id = ?", params: [id] });
        await ctx.fns.procs.db.run({ sql: "DELETE FROM events WHERE agent_id = ?", params: [id] });
        await ctx.fns.events.emitAgentsChanged({ agentId: id, reason: "delete" });
        await ctx.fns.attachments.gc({});
    }
    return { ok: removed };
}
