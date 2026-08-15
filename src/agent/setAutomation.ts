/** Set automation for the runtime.  * @param opts.id Target agent identifier.
 * @param opts.reflectionEnabled Whether automatic reflection is enabled.
 * @param opts.sleepEnabled Whether automatic sleep is enabled.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent identifier. */
    id: string;
        /** Reflection enabled used by the operation. */
    reflectionEnabled: boolean;
        /** Sleep enabled used by the operation. */
    sleepEnabled: boolean;
        /** Whether function retrieval is enabled for user prompts. */
    functionRagEnabled?: boolean },
): Promise<{ reflectionEnabled: boolean; sleepEnabled: boolean; functionRagEnabled: boolean }> {
    const reflectionEnabled = !!opts.reflectionEnabled;
    const sleepEnabled = !!opts.sleepEnabled;
    const functionRagEnabled = opts.functionRagEnabled === true;
    const row = ((await ctx.fns.procs.db.select({ sql: "SELECT sleep_context FROM agents WHERE id = ? AND archived_at IS NULL", params: [opts.id] })) as any[])[0];
    if (!row) throw new Error(`agent not found: ${opts.id}`);
    let sleep = row.sleep_context == null ? null : (typeof row.sleep_context === "string" ? JSON.parse(row.sleep_context) : row.sleep_context);
    if (!sleepEnabled && sleep) {
        sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: sleep });
        if (sleep) sleep.mode = "full";
    }
    await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET reflection_enabled = ?, sleep_enabled = ?, function_rag_enabled = ?, sleep_context = ?::jsonb, updated_at = ? WHERE id = ?",
        params: [reflectionEnabled, sleepEnabled, functionRagEnabled, sleep == null ? null : JSON.stringify(sleep), Date.now(), opts.id],
    });
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) {
        agent.reflectionEnabled = reflectionEnabled;
        agent.sleepEnabled = sleepEnabled;
        agent.functionRagEnabled = functionRagEnabled;
        agent.sleepContext = sleep;
    }
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, reason: "automation" });
    return { reflectionEnabled, sleepEnabled, functionRagEnabled };
}
