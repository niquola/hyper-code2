/** Set sleep active for the runtime.  * @param opts.id Target agent identifier.
 * @param opts.active Whether the sleep revision is active.
 * @param opts.revision Optional sleep-context revision.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent identifier. */
    id: string;
        /** Whether the feature is active. */
    active: boolean;
        /** Revision used by the operation. */
    revision?: number },
): Promise<{ active: boolean; revision: number | null }> {
    const row = ((await ctx.fns.procs.db.select({ sql: "SELECT sleep_context FROM agents WHERE id = ? AND archived_at IS NULL", params: [opts.id] })) as any[])[0];
    if (!row) throw new Error(`agent not found: ${opts.id}`);
    const raw = row.sleep_context == null ? null : (typeof row.sleep_context === "string" ? JSON.parse(row.sleep_context) : row.sleep_context);
    const sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: raw });
    if (!sleep) throw new Error("sleep context is not ready");

    let revision: number | null = null;
    if (opts.active) {
        revision = opts.revision != null ? Number(opts.revision) : sleep.draftRevision ?? sleep.activeRevision;
        if (!sleep.generations.some((x: any) => Number(x.revision) === revision)) throw new Error(`sleep revision not found: ${revision}`);
        sleep.mode = "compact";
        sleep.activeRevision = revision;
        if (sleep.draftRevision === revision) sleep.draftRevision = null;
    } else {
        sleep.mode = "full";
    }
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET sleep_context = ?::jsonb, updated_at = ? WHERE id = ?", params: [JSON.stringify(sleep), Date.now(), opts.id] });
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) agent.sleepContext = sleep;
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, reason: "sleep-switch" });
    return { active: sleep.mode === "compact", revision: sleep.activeRevision };
}
