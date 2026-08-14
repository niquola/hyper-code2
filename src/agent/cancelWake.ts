/** Cancel wake for the runtime.  * @param opts.id Target agent identifier.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string }): Promise<{ cancelled: boolean }> {
    const result = await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET wake_at = NULL, wake_reason = NULL, updated_at = ? WHERE id = ? AND wake_at IS NOT NULL",
        params: [Date.now(), opts.id],
    });
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) { agent.wakeAt = null; agent.wakeReason = null; }
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, reason: "wake-cancel" });
    return { cancelled: result.changes > 0 };
}
