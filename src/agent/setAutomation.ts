export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; reflectionEnabled: boolean; sleepEnabled: boolean },
): Promise<{ reflectionEnabled: boolean; sleepEnabled: boolean }> {
    const reflectionEnabled = !!opts.reflectionEnabled;
    const sleepEnabled = !!opts.sleepEnabled;
    const row = ((await ctx.fns.procs.db.select({ sql: "SELECT sleep_context FROM agents WHERE id = ? AND archived_at IS NULL", params: [opts.id] })) as any[])[0];
    if (!row) throw new Error(`agent not found: ${opts.id}`);
    let sleep = row.sleep_context == null ? null : (typeof row.sleep_context === "string" ? JSON.parse(row.sleep_context) : row.sleep_context);
    if (!sleepEnabled && sleep) {
        sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: sleep });
        if (sleep) sleep.mode = "full";
    }
    await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET reflection_enabled = ?, sleep_enabled = ?, sleep_context = ?::jsonb, updated_at = ? WHERE id = ?",
        params: [reflectionEnabled, sleepEnabled, sleep == null ? null : JSON.stringify(sleep), Date.now(), opts.id],
    });
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) {
        agent.reflectionEnabled = reflectionEnabled;
        agent.sleepEnabled = sleepEnabled;
        agent.sleepContext = sleep;
    }
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, reason: "automation" });
    return { reflectionEnabled, sleepEnabled };
}
