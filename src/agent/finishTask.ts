export default function (
    ctx: Context,
// Mark a delegated task as finished and notify the parent if awaiting
 /**
  * Completes a delegated task, stores the result, and wakes the parent if in await mode.
  */
    opts: { agent: types.agent.Agent; summary: string; result?: any; wakeParent?: boolean },
): { ok: true; parentId: string | null; summary: string; waiterFound: boolean } {
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
    ctx.fns.session.updateScratchpad(ctx, { id: agent.id, scratchpad: agent.scratchpad, ts: finished.finishedAt });
    ctx.fns.session.syncAgentState?.(ctx, { agent });
    const waiters = (((ctx.state as any).delegateTaskWaiters) ??= new Map());
    const waiter = meta.mode === "await" ? waiters.get(agent.id) : null;
    if (waiter?.resolve) {
        waiter.resolve({ childId: agent.id, summary, result: opts?.result ?? null });
        waiters.delete(agent.id);
        return { ok: true, parentId, summary, waiterFound: true };
    }
    return { ok: true, parentId, summary, waiterFound: false };
}
