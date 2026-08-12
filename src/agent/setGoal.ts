export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; statement: string; iterations?: number; enabled?: boolean },
): Promise<any | null> {
    const statement = String(opts.statement ?? "").trim().slice(0, 2000);
    const iterations = Math.max(1, Math.min(10, Math.floor(Number(opts.iterations ?? 3) || 3)));
    const row = ((await ctx.fns.procs.db.select({ sql: "SELECT goal FROM agents WHERE id = ? AND archived_at IS NULL", params: [opts.id] })) as any[])[0];
    if (!row) throw new Error(`agent not found: ${opts.id}`);
    const previous = row.goal == null ? null : (typeof row.goal === "string" ? JSON.parse(row.goal) : row.goal);
    const goal = statement ? {
        statement,
        enabled: opts.enabled !== false,
        maxIterations: iterations,
        revision: Number(previous?.revision ?? 0) + 1,
        status: previous?.statement === statement ? (previous.status ?? "active") : "active",
        checks: previous?.statement === statement && Array.isArray(previous?.checks) ? previous.checks.slice(-9) : [],
        updatedAt: Date.now(),
    } : null;
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET goal = ?::jsonb, updated_at = ? WHERE id = ?", params: [goal == null ? null : JSON.stringify(goal), Date.now(), opts.id] });
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) agent.goal = goal;
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, reason: "goal-set" });
    const shouldActivate = !!goal?.enabled && (!previous?.enabled || previous?.statement !== goal.statement);
    if (shouldActivate) {
        const text = `Goal enabled: ${goal.statement}\n\nWork toward this goal now. Before stopping, the goal checker will verify whether it was reached.`;
        const message = await ctx.fns.session.appendMessage({ id: opts.id, message: {
            role: "user",
            content: text,
            message_type: "goal_activation",
        } });
        await ctx.fns.session.appendEvent({ id: opts.id, event: {
            type: "goal_activation",
            text: goal.statement,
            iterations: goal.maxIterations,
            messageIdx: message.idx,
        } });
        await ctx.fns.procs.db.run({
            sql: "UPDATE agents SET next_run_at = COALESCE(next_run_at, ?), updated_at = ? WHERE id = ?",
            params: [Date.now(), Date.now(), opts.id],
        });
        if (agent) await ctx.fns.session.syncAgentState({ agent });
        ctx.fns.agent.wakeWorker({});
    }
    return goal;
}
