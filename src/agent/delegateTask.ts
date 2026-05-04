export default async function (
    ctx: Context,
/**
 * Delegate a task to a child agent.
 * In "await" mode, blocks until the child calls finishTask.
 * In "async" mode, spawns the child and returns immediately.
 */
    opts: {
        parent: types.agent.Agent;
        task: string;
        forkContext?: boolean;
        instructions?: string;
        mode?: "await" | "async";
        responseFormat?: "text" | "json" | "report" | { kind: "report" | "json"; fields?: string[] };
    },
): Promise<{ childId: string; summary?: string; result?: any; started?: true }> {
    const parentAgent = opts.parent;
    const task = String(opts?.task ?? "").trim();
    if (!task) throw new Error("delegateTask: task is required");
    const mode = opts?.mode === "async" ? "async" : "await";
    const forkContext = !!opts?.forkContext;
    const instructions = String(opts?.instructions ?? "").trim();
    const responseFormat = opts?.responseFormat ?? "text";

    const child = forkContext
        ? ctx.fns.session.fork(ctx, { id: parentAgent.id })
        : ctx.fns.agent.start(ctx, {
            model: parentAgent.model,
            systemPrompt: parentAgent.systemPrompt,
        });

    child.scratchpad ??= {};
    child.scratchpad.delegateTask = {
        parentId: parentAgent.id,
        mode,
        forkContext,
        task,
        instructions,
        responseFormat,
        status: "running",
    };
    ctx.fns.session.save(ctx, { agent: child });
    ctx.fns.session.updateScratchpad(ctx, { id: child.id, scratchpad: child.scratchpad });
    ctx.fns.session.syncAgentState?.(ctx, { agent: child });

    const prompt = ctx.fns.agent.buildDelegatedTaskPrompt(ctx, { task, instructions, responseFormat });

    if (mode === "async") {
        void ctx.fns.agent.run(ctx, { agent: child, userText: prompt });
        return { childId: child.id, started: true };
    }

    const waiters = (((ctx.state as any).delegateTaskWaiters) ??= new Map());
    const waiter = new Promise<{ childId: string; summary: string; result: any }>((resolve, reject) => {
        waiters.set(child.id, { resolve, reject, parentId: parentAgent.id, createdAt: Date.now() });
    });

    try {
        await ctx.fns.agent.run(ctx, { agent: child, userText: prompt });
        const meta = child.scratchpad?.delegateTask;
        if (meta?.status === "finished" && meta.result) {
            waiters.delete(child.id);
            return { childId: child.id, summary: meta.result.summary, result: meta.result.result ?? null };
        }
        waiters.delete(child.id);
        throw new Error("delegateTask: child completed without finishTask");
    } catch (error) {
        waiters.delete(child.id);
        console.error(`delegateTask failed for child ${child.id}:`, error);
        throw error;
    }
}
