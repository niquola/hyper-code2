export default function (ctx: Context, _session: Session | null, opts: { id: string }): { ok: boolean } {
    const { id } = opts;
    const res = ctx.fns.procs.db.run({ sql: "DELETE FROM agents WHERE id = ?", params: [id] });
    const removed = res.changes > 0;
    if (removed) {
        ctx.fns.procs.db.run({ sql: "DELETE FROM messages WHERE agent_id = ?", params: [id] });
        ctx.fns.procs.db.run({ sql: "DELETE FROM events WHERE agent_id = ?", params: [id] });
        ctx.fns.events.emitAgentsChanged({ agentId: id, reason: "delete" });
    }
    return { ok: removed };
}
