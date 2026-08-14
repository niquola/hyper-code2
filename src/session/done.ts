/** Done for the runtime. */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Live agent instance to operate on. */
    agent?: types.agent.Agent;
        /** Agent identifier. */
    id: string },
): Promise<any> {
    const agent = opts.agent ?? (session as any)?.agent;
    if (!agent?.id) throw new Error("done: agent is required");
    const id = String(opts.id ?? "").trim();
    if (!id) throw new Error("done: id is required");

    const updated: any = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>, now: number) => {
        const plan = scratchpad.plan;
        if (!plan || !Array.isArray(plan.tasks)) throw new Error("done: no active plan");
        const task = plan.tasks.find((item: any) => item?.id === id);
        if (!task) throw new Error(`done: unknown task id "${id}"`);
        const alreadyDone = task.status === "done";
        if (!alreadyDone) {
            if (task.status !== "active") throw new Error(`done: task "${id}" is not active`);
            if (task.activeSince) task.elapsedMs = Math.max(0, Number(task.elapsedMs ?? 0)) + Math.max(0, now - Number(task.activeSince));
            task.activeSince = null;
            task.completedAt = now;
            task.status = "done";
        }

        let next = plan.tasks.find((item: any) => item.status === "active");
        if (!next) {
            next = plan.tasks.find((item: any) => item.status === "pending");
            if (next) {
                next.status = "active";
                next.startedAt ??= now;
                next.activeSince = now;
            }
        }
        plan.updatedAt = now;
        plan.pausedAt = null;
        const done = plan.tasks.filter((item: any) => item.status === "done").length;
        return {
            alreadyDone,
            completed: { id: task.id, title: task.title, elapsedMs: task.elapsedMs },
            next: next ? { id: next.id, title: next.title, instructions: next.instructions } : null,
            complete: !next,
            progress: { done, total: plan.tasks.length },
        };
    } });
    agent.scratchpad = updated.scratchpad;
    ctx.fns.events.refreshAgentMeta({ agentId: agent.id, reason: "plan-done" });
    return { ok: true, ...updated.result };
}
