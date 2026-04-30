export default function (ctx: Context, id: string): { ok: boolean } {
    const res = ctx.fns.db.exec(ctx, 'UPDATE agents SET archived_at = ? WHERE id = ?', [Date.now(), id]);
    const ok = res.changes > 0;
    if (ok) ctx.fns.events.emitAgentsChanged(ctx, { agentId: id, reason: 'archive' });
    return { ok };
}
