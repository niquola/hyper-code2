/**
 * Restore an archived team member to active Team and agent lists
 *
 * Unarchives a direct child while preserving its transcript, plan, result, and parent relationship. Use when a parent needs to resume or ask follow-up questions of a previously archived delegated agent.
 * @param opts.agent Parent agent that owns the archived team member.
 * @param opts.member Archived direct child agent ID to restore.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Parent agent that owns the archived team member. */
        agent: types.agent.Agent;
        /** Archived direct child agent ID to restore. */
        member: string;
    },
): Promise<{ unarchived: boolean; member: string }> {
    const member = String(opts.member ?? "").trim();
    if (!member) throw new Error("unarchiveMember: member is required");
    const rows = (await ctx.fns.procs.db.select({ sql: "SELECT parent_id, archived_at FROM agents WHERE id = ?", params: [member] })) as any[];
    if (!rows[0] || String(rows[0].parent_id ?? "") !== opts.agent.id) throw new Error("unarchiveMember: member is not a direct child of this agent");
    if (rows[0].archived_at == null) return { unarchived: false, member };
    await ctx.fns.session.unarchive({ id: member });
    ctx.fns.events.refreshAgentMeta({ agentId: opts.agent.id, reason: "team-unarchive" });
    return { unarchived: true, member };
}
