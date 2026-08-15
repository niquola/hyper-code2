/**
 * Send a durable team update from a delegated child to its parent
 *
 * Persists a structured progress, completion, blocked, or failure notification in the parent transcript, refreshes both Meta panels, and schedules an idle parent immediately. Use internally when a delegated child changes meaningful task state.
 * @param opts.from Delegated child agent sending the update; its parentId determines the recipient.
 * @param opts.event Team lifecycle event represented by the update.
 * @param opts.summary Short parent-facing description of completed work or a problem.
 * @param opts.taskId Stable child plan task identifier when the event concerns one task.
 * @param opts.taskTitle Human-readable child plan task title when available.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Delegated child agent sending the update; its parentId determines the recipient. */
        from: types.agent.Agent;
        /** Team lifecycle event represented by the update. */
        event: "task.completed" | "plan.completed" | "answer" | "blocked" | "failed";
        /** Short parent-facing description of completed work or a problem. */
        summary: string;
        /** Stable child plan task identifier when the event concerns one task. */
        taskId?: string;
        /** Human-readable child plan task title when available. */
        taskTitle?: string;
    },
): Promise<{ delivered: boolean; parentId: string | null; messageIdx?: number }> {
    const child = opts.from;
    const parentId = child.parentId ? String(child.parentId) : null;
    if (!parentId) return { delivered: false, parentId: null };
    const summary = String(opts.summary ?? "").trim().slice(0, 4000);
    if (!summary) throw new Error("steer: summary is required");
    const taskTitle = opts.taskTitle ? String(opts.taskTitle) : null;
    const content = '<team-update member="' + child.id + '" event="' + opts.event + '">Agent ' + child.id + ' ' + opts.event + (taskTitle ? ' task "' + taskTitle + '"' : '') + '. ' + summary + '</team-update>';
    const ts = Date.now();
    const message = await ctx.fns.session.appendMessage({ id: parentId, message: { role: "user", content, message_type: "team_update" } });
    await ctx.fns.session.appendEvent({ id: parentId, event: { type: "team_update", event: opts.event, memberId: child.id, taskId: opts.taskId ?? null, taskTitle, summary, messageIdx: message.idx } });
    if (opts.event === "blocked" || opts.event === "failed") {
        child.scratchpad ??= {};
        const meta = child.scratchpad.delegation;
        if (meta && typeof meta === "object") {
            meta.status = opts.event;
            meta.summary = summary;
            await ctx.fns.session.updateScratchpad({ id: child.id, scratchpad: child.scratchpad });
        }
    }
    // Always set a schedule, including while the parent is running. The worker
    // claim already consumed the previous schedule; preserving this value makes
    // a team update that lands during the final model call trigger another pass.
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET next_run_at = COALESCE(next_run_at, ?), updated_at = ? WHERE id = ? AND archived_at IS NULL", params: [ts, ts, parentId] });
    const parent = (ctx.state as any).agent?.[parentId];
    if (parent) await ctx.fns.session.syncAgentState({ agent: parent });
    ctx.fns.events.refreshAgentMeta({ agentId: parentId, reason: "team-update" });
    ctx.fns.events.refreshAgentMeta({ agentId: child.id, reason: "team-update" });
    ctx.fns.agent.wakeWorker({});
    return { delivered: true, parentId, messageIdx: message.idx };
}
