/** Finish task for the runtime.  * @param opts.agent Agent whose state is read or updated.
 * @param opts.summary Concise summary of completed work or compacted context.
 * @param opts.result Optional detailed result returned to the parent.
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
        /** Optional task result returned to the parent. */
    result?: any;
        /** Wake parent used by the operation. */
    wakeParent?: boolean },
): Promise<{ ok: true; parentId: string | null; summary: string; waiterFound: boolean }> {
    const { agent } = opts;
    const meta = agent.scratchpad?.delegateTask;
    if (!meta || typeof meta !== "object") throw new Error("finishTask: missing delegateTask metadata");
    const summary = String(opts?.summary ?? "").trim();
    if (!summary) throw new Error("finishTask: summary is required");
    const parentId = meta.parentId ? String(meta.parentId) : null;
    const finished = {
        summary,
        result: opts?.result ?? null,
        finishedAt: Date.now(),
    };
    meta.status = "finished";
    meta.result = finished;
    agent.scratchpad.delegateTask = meta;
    await ctx.fns.session.updateScratchpad({ id: agent.id, scratchpad: agent.scratchpad, ts: finished.finishedAt });
    await ctx.fns.session.syncAgentState?.({ agent });
    const waiters = (((ctx.state as any).delegateTaskWaiters) ??= new Map());
    const waiter = meta.mode === "await" ? waiters.get(agent.id) : null;
    if (waiter?.resolve) {
        waiter.resolve({ childId: agent.id, summary, result: opts?.result ?? null });
        waiters.delete(agent.id);
        return { ok: true, parentId, summary, waiterFound: true };
    }
    return { ok: true, parentId, summary, waiterFound: false };
}
