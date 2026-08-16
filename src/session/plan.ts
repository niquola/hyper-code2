/**
 * Creates a visible multi-step work plan for an agent.
 *
 * Task IDs are stable identifiers used by `session.done` and plan updates.
 */

export default async function (
    ctx: Context,
    session: Session | null,
    opts: {

        /** Agent that owns the plan; defaults to the current session agent. */
        agent?: types.agent.Agent;

        /** Short user-visible plan title. */
        title?: string;

        /** Ordered tasks; the first task becomes active immediately. */
        tasks: Array<{

        /** Stable task identifier. */
            id: string;

        /** Short user-visible task title. */
            title: string;

        /** Detailed execution guidance. */
            instructions?: string;
        }>;
    },
): Promise<any> {
    const agent = opts.agent ?? (session as any)?.agent;
    if (!agent?.id) throw new Error("plan: agent is required");
    if (!Array.isArray(opts.tasks) || opts.tasks.length === 0) throw new Error("plan: tasks must not be empty");

    const ids = new Set<string>();
    const inputs = opts.tasks.map((input, index) => {
        const id = String(input?.id ?? "").trim();
        const title = String(input?.title ?? "").trim();
        const instructions = String(input?.instructions ?? "").trim();
        if (!id || id.length > 120) throw new Error(`plan: task ${index + 1} has an invalid id`);
        if (ids.has(id)) throw new Error(`plan: duplicate task id "${id}"`);
        if (!title || title.length > 300) throw new Error(`plan: task "${id}" has an invalid title`);
        if (instructions.length > 12_000) throw new Error(`plan: instructions for "${id}" are too long`);
        ids.add(id);
        return { id, title, instructions };
    });

    const updated: any = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>, now: number) => {
        const tasks = inputs.map((input, index) => ({
            ...input,
            status: index === 0 ? "active" : "pending",
            startedAt: index === 0 ? now : null,
            activeSince: index === 0 ? now : null,
            elapsedMs: 0,
            completedAt: null,
        }));
        const plan = {
            version: 1,
            title: String(opts.title ?? "").trim().slice(0, 300),
            tasks,
            createdAt: now,
            updatedAt: now,
            pausedAt: null,
        };
        scratchpad.plan = plan;
        return { plan, active: tasks[0] };
    } });
    agent.scratchpad = updated.scratchpad;
    ctx.fns.events.refreshAgentMeta({ agentId: agent.id, section: "plan", reason: "plan" });
    if (agent.parentId) ctx.fns.events.refreshAgentMeta({ agentId: String(agent.parentId), section: "team", reason: "team-plan" });
    return { ok: true, ...updated.result };
}
