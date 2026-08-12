export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; check: any },
): Promise<any> {
    const goal = { ...(opts.agent.goal ?? {}) };
    const entry = { ...opts.check, at: Date.now() };
    goal.checks = [...(Array.isArray(goal.checks) ? goal.checks : []), entry].slice(-10);
    goal.status = entry.status === "achieved" ? "achieved" : entry.status === "continue" ? "active" : entry.status;
    goal.updatedAt = entry.at;
    if (entry.status === "achieved") goal.enabled = false;
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET goal = ?::jsonb, updated_at = ? WHERE id = ?", params: [JSON.stringify(goal), entry.at, opts.agent.id] });
    opts.agent.goal = goal;
    ctx.fns.events.refreshAgentMeta({ agentId: opts.agent.id, reason: "goal-check" });
    return goal;
}
