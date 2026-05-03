export default function (ctx: Context, opts: { id: string }): { ok: boolean } {
    const { id } = opts;
    const res = ctx.fns.db.exec(ctx, { sql: 'UPDATE agents SET archived_at = ? WHERE id = ?', params: [Date.now(), id] });
    const ok = res.changes > 0;
    if (ok) ctx.fns.events.emitAgentsChanged(ctx, { agentId: id, reason: 'archive' });
    return { ok };
}
