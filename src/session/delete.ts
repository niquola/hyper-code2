export default function (ctx: Context, id: string): { ok: boolean } {
    const res = ctx.fns.db.exec(ctx, "DELETE FROM agents WHERE id = ?", [id]);
    const removed = res.changes > 0;
    if (removed) {
        ctx.fns.db.exec(ctx, "DELETE FROM messages WHERE agent_id = ?", [id]);
        ctx.fns.db.exec(ctx, "DELETE FROM events WHERE agent_id = ?", [id]);
        ctx.fns.events.emitAgentsChanged(ctx, { agentId: id, reason: "delete" });
    }
    return { ok: removed };
}
