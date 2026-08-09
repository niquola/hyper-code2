export default function (ctx: Context, _session: Session | null, opts: { id: string }): { ok: boolean } {
    const { id } = opts;
    const res = ctx.fns.procs.db.run({ sql: 'UPDATE agents SET archived_at = ? WHERE id = ?', params: [Date.now(), id] });
    const ok = res.changes > 0;
    if (ok) ctx.fns.events.emitAgentsChanged({ agentId: id, reason: 'archive' });
    return { ok };
}
