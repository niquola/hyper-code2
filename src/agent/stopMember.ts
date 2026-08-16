/**
 * Stop a running delegated child and mark it blocked for explicit retry
 *
 * Validates direct team ownership, aborts or clears queued work through agent.stop, records a blocked delegation status, steers the reason to the parent, and refreshes Team. Use from the Meta panel when delegated work must be interrupted.
 * @param opts.agent Parent agent that owns the delegated child.
 * @param opts.member Direct delegated child agent ID to stop.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Parent agent that owns the delegated child. */
        agent: types.agent.Agent;
        /** Direct delegated child agent ID to stop. */
        member: string;
    },
): Promise<{ stopped: boolean; member: string }> {
    const member = String(opts.member ?? "").trim();
    const rows = (await ctx.fns.procs.db.select({ sql: "SELECT parent_id, archived_at FROM agents WHERE id = ?", params: [member] })) as any[];
    if (!rows[0] || String(rows[0].parent_id ?? "") !== opts.agent.id || rows[0].archived_at != null) throw new Error("stopMember: member is not an active direct child");
    const child = (ctx.state as any).agent?.[member] ?? await ctx.fns.session.load({ id: member });
    if (!child) throw new Error("stopMember: member not found");
    await ctx.fns.agent.stop({ agent: child, clearQueue: true });
    const updated: any = await ctx.fns.session.mutateScratchpad({ id: member, mutate: (scratchpad: Record<string, any>, now: number) => {
      const meta = scratchpad.delegation ?? scratchpad.delegateTask;
      if (!meta) throw new Error("stopMember: member is not delegated");
      meta.status = "blocked"; meta.summary = "Stopped by parent"; meta.stoppedAt = now;
    } });
    child.scratchpad = updated.scratchpad;
    await ctx.fns.agent.steer({ from: child, event: "blocked", summary: "Stopped by parent" });
    ctx.fns.events.refreshAgentMeta({ agentId: opts.agent.id, section: "team", reason: "team-stop" });
    return { stopped: true, member };
}
