/** Finish task for the runtime.  * @param opts.agent Agent whose state is read or updated.
 * @param opts.summary Concise summary of completed work or compacted context.
 * @param opts.result Required JSON-compatible result returned to the parent and stored on the final completed plan task.
 * @param opts.wakeParent Whether to queue the parent after task completion.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
// Mark a delegated task as finished and notify the parent if awaiting

        /**
  * Completes a delegated task, stores the result, and wakes the parent if in await mode.
  */
    opts: {
        /** Live agent instance to operate on. */
    agent: types.agent.Agent;
        /** Concise summary of the operation or result. */
    summary: string;
        /** Required JSON-compatible result stored on the final completed plan task. */
    result: any;
        /** Wake parent used by the operation. */
    wakeParent?: boolean },
): Promise<{ ok: true; parentId: string | null; summary: string; waiterFound: boolean }> {
    const { agent } = opts;
    const currentMeta = agent.scratchpad?.delegation ?? agent.scratchpad?.delegateTask;
    if (!currentMeta || typeof currentMeta !== "object") throw new Error("finishTask: missing delegation metadata");
    const summary = String(opts?.summary ?? "").trim();
    if (!summary) throw new Error("finishTask: summary is required");
    if (opts.result === undefined || opts.result === null) throw new Error("finishTask: result is required");
    const parentId = currentMeta.parentId ? String(currentMeta.parentId) : null;
    const finishedAt = Date.now();
    const updated: any = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>) => {
        const delegated = !!scratchpad.delegation;
        const meta = scratchpad.delegation ?? scratchpad.delegateTask;
        if (!meta || typeof meta !== "object") throw new Error("finishTask: missing delegation metadata");
        const terminal = delegated ? meta.status === "ready" : meta.status === "finished";
        if (terminal) return { alreadyFinished: true, meta };
        if (delegated) {
            const tasks = Array.isArray(scratchpad?.plan?.tasks) ? scratchpad.plan.tasks : [];
            const finalTask = [...tasks].reverse().find((task: any) => task.status === "done");
            if (!finalTask || tasks.some((task: any) => task.status !== "done")) {
                throw new Error("finishTask: delegated plan must be fully completed before finishing");
            }
            finalTask.result = opts.result;
            finalTask.resultSummary = summary;
            finalTask.resultAt = finishedAt;
            scratchpad.plan.updatedAt = finishedAt;
        }
        const finished = { summary, result: opts.result, finishedAt };
        meta.status = delegated ? "ready" : "finished";
        meta.summary = summary;
        meta.result = finished;
        if (delegated) scratchpad.delegation = meta;
        else scratchpad.delegateTask = meta;
        return { alreadyFinished: false, meta };
    } });
    agent.scratchpad = updated.scratchpad;
    const meta = updated.result.meta;
    if (updated.result.alreadyFinished) {
        await ctx.fns.session.syncAgentState?.({ agent });
        return { ok: true, parentId, summary: String(meta.summary ?? summary), waiterFound: false };
    }
    await ctx.fns.session.syncAgentState?.({ agent });
    const waiters = (((ctx.state as any).delegateTaskWaiters) ??= new Map());
    if (agent.parentId) {
        await ctx.fns.agent.steer({ from: agent, event: "plan.completed", summary });
        ctx.fns.events.refreshAgentMeta({ agentId: String(agent.parentId), reason: "team-finished" });
    }
    const waiter = meta.mode === "await" ? waiters.get(agent.id) : null;
    if (waiter?.resolve) {
        waiter.resolve({ childId: agent.id, summary, result: opts.result });
        waiters.delete(agent.id);
        return { ok: true, parentId, summary, waiterFound: true };
    }
    return { ok: true, parentId, summary, waiterFound: false };
}
