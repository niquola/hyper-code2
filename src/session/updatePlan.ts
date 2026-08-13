export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        agent?: types.agent.Agent;
        title?: string;
        tasks: Array<{ id: string; title: string; instructions?: string }>;
    },
): Promise<{ ok: true; plan: any }> {
    const agent = opts.agent ?? (session as any)?.agent;
    if (!agent?.id) throw new Error("updatePlan: agent is required");
    if (!Array.isArray(opts.tasks) || opts.tasks.length === 0) throw new Error("updatePlan: tasks must not be empty");

    const ids = new Set<string>();
    const inputs = opts.tasks.map((input, index) => {
        const id = String(input?.id ?? "").trim();
        const title = String(input?.title ?? "").trim();
        const instructions = String(input?.instructions ?? "").trim();
        if (!id || id.length > 120) throw new Error(`updatePlan: task ${index + 1} has an invalid id`);
        if (ids.has(id)) throw new Error(`updatePlan: duplicate task id "${id}"`);
        if (!title || title.length > 300) throw new Error(`updatePlan: task "${id}" has an invalid title`);
        if (instructions.length > 12_000) throw new Error(`updatePlan: instructions for "${id}" are too long`);
        ids.add(id);
        return { id, title, instructions };
    });

    const updated: any = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>, now: number) => {
        const plan = scratchpad.plan;
        if (!plan || !Array.isArray(plan.tasks)) throw new Error("updatePlan: no active plan");
        const existing = new Map<string, any>(plan.tasks.map((task: any) => [String(task.id), task]));
        const fixed = plan.tasks.filter((task: any) => task.status !== "pending");
        for (const task of fixed) {
            if (!ids.has(String(task.id))) throw new Error(`updatePlan: ${task.status} task "${task.id}" cannot be removed`);
        }
        const submittedFixed = inputs.filter(input => existing.get(input.id)?.status !== "pending" && existing.has(input.id));
        if (submittedFixed.map(input => input.id).join("\n") !== fixed.map((task: any) => String(task.id)).join("\n")) {
            throw new Error("updatePlan: active/done tasks cannot be reordered");
        }
        const firstPending = inputs.findIndex(input => !existing.has(input.id) || existing.get(input.id)?.status === "pending");
        if (firstPending >= 0 && inputs.slice(firstPending).some(input => existing.get(input.id)?.status !== "pending" && existing.has(input.id))) {
            throw new Error("updatePlan: pending tasks must follow active/done tasks");
        }

        plan.tasks = inputs.map(input => {
            const old: any = existing.get(input.id);
            return old ? { ...old, title: input.title, instructions: input.instructions } : {
                ...input,
                status: "pending",
                startedAt: null,
                activeSince: null,
                elapsedMs: 0,
                completedAt: null,
            };
        });
        plan.title = String(opts.title ?? plan.title ?? "").trim().slice(0, 300);
        // A completed plan can be extended from the UI. The first newly added
        // task must become active; leaving every new row pending produces a
        // plan that looks saved but can never run or advance.
        if (!plan.tasks.some((task: any) => task.status === "active")) {
            const next = plan.tasks.find((task: any) => task.status === "pending");
            if (next) {
                next.status = "active";
                next.startedAt ??= now;
                next.activeSince = now;
            }
        }
        plan.updatedAt = now;
        return plan;
    } });
    agent.scratchpad = updated.scratchpad;
    ctx.fns.events.refreshAgentMeta({ agentId: agent.id, reason: "plan-updated" });
    return { ok: true, plan: updated.result };
}
