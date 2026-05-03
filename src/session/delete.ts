export default function (ctx: Context, opts: { id: string }): { ok: boolean } {
    const { id } = opts;
    const res = ctx.fns.db.exec(ctx, { sql: "DELETE FROM agents WHERE id = ?", params: [id] });
    const removed = res.changes > 0;
    if (removed) {
        ctx.fns.db.exec(ctx, { sql: "DELETE FROM messages WHERE agent_id = ?", params: [id] });
        ctx.fns.db.exec(ctx, { sql: "DELETE FROM events WHERE agent_id = ?", params: [id] });
        ctx.fns.events.emitAgentsChanged(ctx, { agentId: id, reason: "delete" });
    }
    return { ok: removed };
}
