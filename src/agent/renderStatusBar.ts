/** Render status bar for the runtime.  * @param opts.agentId Target agent identifier.
 * @param opts.initialUsage Initial token usage shown in the status bar.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent id used by the operation. */
agentId: string;
        /** Initial usage used by the operation. */
initialUsage?: any }): Promise<string> {
    const { agentId, initialUsage } = opts;
    let usage = initialUsage;
    const now = Date.now();
    const row = ((await ctx.fns.procs.db.select({
        sql: 'SELECT run_state, run_started_at, next_run_at, last_processed_msg_idx, last_error FROM agents WHERE id = ?',
        params: [agentId],
    })) as any[])[0];

    if (!usage) {
        const lastEvent = ((await ctx.fns.procs.db.select({
            sql: 'SELECT payload FROM events WHERE agent_id = ? AND type = \'assistant\' ORDER BY idx DESC LIMIT 1',
            params: [agentId],
        })) as any[])[0];
        usage = lastEvent ? JSON.parse(lastEvent.payload).usage : null;
    }
    let label: string;
    let cls: string;

    if (row?.run_state === 'running') {
        const elapsed = ((now - Number(row.run_started_at ?? now)) / 1000).toFixed(1);
        const lastEv = ((await ctx.fns.procs.db.select({
            sql: 'SELECT MAX(ts) AS t FROM events WHERE agent_id = ?',
            params: [agentId],
        })) as any[])[0];
        const quiet = lastEv?.t ? Math.round((now - Number(lastEv.t)) / 1000) : null;
        label = `<i class="ph ph-spinner-gap animate-spin" aria-hidden="true"></i><span>${elapsed}s${quiet != null && quiet > 10 ? ` · quiet ${quiet}s` : ''}</span>`;
        cls = 'text-info bg-info/10 border-ui-border';
    } else if (row?.next_run_at) {
        const waits = Math.max(0, (Number(row.next_run_at) - now) / 1000).toFixed(1);
        label = `queued · ${waits}s`;
        cls = 'text-warning bg-warning/10 border-ui-border';
    } else if (row?.last_error) {
        // A failed run does NOT auto-retry (by design) — without this badge it
        // looks like a hang. The next user message retries; say so.
        label = 'error';
        cls = 'text-error bg-error/10 border-ui-border';
    } else {
        label = 'idle';
        cls = 'text-base-content/55 bg-base-200 border-ui-border';
    }

    const url = `/agent/${encodeURIComponent(agentId)}/statusbar`;
    const esc = (t: any) => ctx.fns.procs.ui.escape({ text: t });
    const statusBadge = row?.last_error && row?.run_state !== 'running'
        ? `<span class="text-xs px-2 py-0.5 rounded border font-mono ${cls} max-w-[16rem] truncate inline-block align-bottom" title="${esc(String(row.last_error))} — send a message to retry">error: ${esc(String(row.last_error).slice(0, 48))}</span>`
        : `<span class="text-xs px-2 py-0.5 rounded border font-mono inline-flex items-center gap-1 ${cls}" title="${row?.run_state === 'running' ? 'running' : esc(label)}">${label}</span>`;
    const tokensBadge = usage ? `<span title="context tokens" class="rounded border border-ui-border bg-base-200 px-2 py-0.5 font-mono text-xs text-base-content/65">${(((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)) / 1000).toFixed(1)}k</span>` : '';
    // Stop exists only while there is something to stop — a running turn or a
    // queued one. It lives in this fragment because the fragment re-renders
    // every second: the button appears with the run and leaves with it.
    const busy = row?.run_state === 'running' || !!row?.next_run_at;
    const stopBtn = busy
        ? `<form method="POST" action="/agent/${encodeURIComponent(agentId)}/stop" class="inline"><button title="stop this run" ${ctx.fns.procs.ui.attr({ action: "stop", entity: "agent", id: agentId })} class="rounded border border-error/30 bg-error/10 px-1 py-0.5 text-xs text-error hover:bg-error/20"><i class="ph ph-stop-circle align-middle"></i></button></form>`
        : '';
    // The SSE stream is the real trigger (it dispatches hyper-tick on every
    // agent event); the timer is only a safety net. A busy agent still refreshes
    // often enough to keep its elapsed counter honest, but an idle one costs one
    // request every half minute instead of one per second — three widgets each
    // polling once a second was what made a burst of clicks queue behind the
    // browser's six sockets.
    // A live region: the shared stream tells it when its agent moved, and the
    // interval is only a watchdog. A running agent keeps a short one so the
    // elapsed counter stays honest; an idle one costs a request every half
    // minute instead of one per second.
    return ctx.fns.ui.live({
        id: "status-bar",
        url,
        topic: `agent:${agentId}`,
        every: busy ? 5 : 30,
        attrs: 'class="flex items-center gap-2"',
        html: `${statusBadge}${tokensBadge}${stopBtn}`,
    });
}