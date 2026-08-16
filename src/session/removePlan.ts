/** Remove plan for the runtime. */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Live agent instance to operate on. */
    agent?: types.agent.Agent;
        /** Whether removed data should be archived. */
    archive?: boolean },
): Promise<{ ok: boolean; archived: boolean }> {
    const agent = opts.agent ?? (session as any)?.agent;
    if (!agent?.id) throw new Error("removePlan: agent is required");
    const archive = opts.archive !== false;
    const updated: any = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>, now: number) => {
        const plan = scratchpad.plan;
        if (!plan) return { archived: false };
        if (archive) {
            const active = Array.isArray(plan.tasks) ? plan.tasks.find((task: any) => task.status === "active") : null;
            if (active?.activeSince) {
                active.elapsedMs = Math.max(0, Number(active.elapsedMs ?? 0)) + Math.max(0, now - Number(active.activeSince));
                active.activeSince = null;
            }
            const history = Array.isArray(scratchpad.planHistory) ? scratchpad.planHistory : [];
            scratchpad.planHistory = [{ ...plan, archivedAt: now }, ...history].slice(0, 20);
        }
        delete scratchpad.plan;
        return { archived: archive };
    } });
    agent.scratchpad = updated.scratchpad;
    ctx.fns.events.refreshAgentMeta({ agentId: agent.id, section: "plan", reason: updated.result.archived ? "plan-archived" : "plan-deleted" });
    return { ok: true, archived: updated.result.archived };
}
