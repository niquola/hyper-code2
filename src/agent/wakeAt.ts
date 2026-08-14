export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; at: number; reason: string },
): Promise<{ wakeAt: number; reason: string }> {
    const wakeAt = Math.floor(Number(opts.at));
    const reason = String(opts.reason ?? "").trim().slice(0, 1000);
    if (!Number.isFinite(wakeAt) || wakeAt <= Date.now()) throw new Error("wakeAt: at must be in the future");
    if (!reason) throw new Error("wakeAt: reason is required");
    const result = await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET wake_at = ?, wake_reason = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL",
        params: [wakeAt, reason, Date.now(), opts.id],
    });
    if (result.changes === 0) throw new Error(`agent not found: ${opts.id}`);
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) { agent.wakeAt = wakeAt; agent.wakeReason = reason; }
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, reason: "wake-set" });
    ctx.fns.agent.wakeWorker({});
    return { wakeAt, reason };
}
