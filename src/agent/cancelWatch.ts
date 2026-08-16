/** Cancel watch for the runtime.  * @param opts.id Target agent identifier.
 * @param opts.watchId Conditional watch identifier.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string;
        /** Watch identifier. */
watchId: string }): Promise<{ cancelled: boolean }> {
    const result = await ctx.fns.procs.db.run({
        sql: "UPDATE agent_watches SET status = 'cancelled', finished_at = ? WHERE id = ? AND agent_id = ? AND status = 'active'",
        params: [Date.now(), opts.watchId, opts.id],
    });
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, section: "wake", reason: "watch-cancel" });
    return { cancelled: result.changes > 0 };
}
