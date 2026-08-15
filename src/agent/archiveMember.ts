/**
 * Archive a completed team member so it leaves active agent and Team lists
 *
 * Archives a direct child agent after its delegated result is no longer needed for immediate follow-up. Use manually or from retention cleanup; the transcript remains durable and can be restored with session.unarchive.
 * @param opts.agent Parent agent that owns the team member.
 * @param opts.member Direct child agent ID to archive.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Parent agent that owns the team member. */
        agent: types.agent.Agent;
        /** Direct child agent ID to archive. */
        member: string;
    },
): Promise<{ archived: boolean; member: string }> {
    const member = String(opts.member ?? "").trim();
    if (!member) throw new Error("archiveMember: member is required");
    const rows = (await ctx.fns.procs.db.select({ sql: "SELECT parent_id, archived_at, run_state, scratchpad FROM agents WHERE id = ?", params: [member] })) as any[];
    if (!rows[0] || String(rows[0].parent_id ?? "") !== opts.agent.id) throw new Error("archiveMember: member is not a direct child of this agent");
    if (rows[0].archived_at != null) return { archived: false, member };
    const scratchpad = typeof rows[0].scratchpad === "string" ? JSON.parse(rows[0].scratchpad) : (rows[0].scratchpad ?? {});
    const status = String(scratchpad.delegation?.status ?? scratchpad.delegateTask?.status ?? "working");
    if (String(rows[0].run_state ?? "idle") !== "idle" || status === "working" || status === "running") {
        throw new Error("archiveMember: cannot archive a working member");
    }
    await ctx.fns.session.archive({ id: member });
    ctx.fns.events.refreshAgentMeta({ agentId: opts.agent.id, reason: "team-archive" });
    return { archived: true, member };
}
