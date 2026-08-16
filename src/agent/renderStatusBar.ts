/** Render status bar for the runtime.  * @param opts.agentId Target agent identifier.
 * @param opts.initialUsage Initial token usage shown in the status bar.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent id used by the operation. */
agentId: string;
        /** Initial usage used by the operation. */
initialUsage?: any;
        /** Render only the composer stop control or the informational top-bar status. */
        part?: 'status' | 'stop' }): Promise<string> {
    const { agentId, initialUsage } = opts;
    const part = opts.part ?? 'status';
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
    let title: string;
    let cls: string;
    let borderCls = '';


    if (row?.run_state === 'running') {
        const elapsed = ((now - Number(row.run_started_at ?? now)) / 1000).toFixed(1);
        const lastEv = ((await ctx.fns.procs.db.select({
            sql: 'SELECT MAX(ts) AS t FROM events WHERE agent_id = ?',
            params: [agentId],
        })) as any[])[0];
        const quiet = lastEv?.t ? Math.round((now - Number(lastEv.t)) / 1000) : null;
        label = `<i class="ph ph-spinner-gap animate-spin" aria-hidden="true"></i><span>${elapsed}s${quiet != null && quiet > 10 ? ` · quiet ${quiet}s` : ''}</span>`;
        title = 'running';
        cls = 'text-info';
    } else if (row?.next_run_at) {
        const waits = Math.max(0, (Number(row.next_run_at) - now) / 1000).toFixed(1);
        label = `<i class="ph ph-clock-countdown" aria-hidden="true"></i><span>${waits}s</span>`;
        title = `queued · ${waits}s`;
        cls = 'text-warning';
    } else if (row?.last_error) {
        // A failed run does NOT auto-retry (by design) — without this badge it
        // looks like a hang. The next user message retries; say so.
        label = 'error';
        title = 'error';
        cls = 'text-error bg-error/10 border-ui-border';
    } else {
        label = '<i class="ph ph-circle" aria-hidden="true"></i>';
        title = 'idle';
        cls = 'text-base-content/45';
        borderCls = '';
    }

    const url = `/agent/${encodeURIComponent(agentId)}/statusbar`;
    const esc = (t: any) => ctx.fns.procs.ui.escape({ text: t });
    const statusBadge = row?.last_error && row?.run_state !== 'running'
        ? `<span class="text-xs px-2 py-0.5 rounded border font-mono ${cls} max-w-[16rem] truncate inline-block align-bottom" title="${esc(String(row.last_error))} — send a message to retry">error: ${esc(String(row.last_error).slice(0, 48))}</span>`
        : `<span class="text-xs px-2 py-0.5 rounded ${borderCls} font-mono inline-flex items-center gap-1 ${cls}" title="${esc(title)}">${label}</span>`;
    const tokensBadge = usage ? `<span title="context tokens" class="rounded px-1 py-0.5 font-mono text-xs text-base-content/65">${(((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)) / 1000).toFixed(1)}k</span>` : '';
    // Stop is rendered by this live fragment so it appears and disappears with
    // the run, but CSS anchors it inside the composer instead of the top bar.
    const busy = row?.run_state === 'running' || !!row?.next_run_at;
    const stopBtn = busy
        ? `<button type="button" hx-post="/agent/${encodeURIComponent(agentId)}/stop" hx-swap="none" title="stop this run" aria-label="Stop generation" ${ctx.fns.procs.ui.attr({ action: "stop", entity: "agent", id: agentId })} class="inline-flex size-8 items-center justify-center rounded-full bg-gray-900 text-white shadow-md transition hover:bg-gray-700"><span class="block size-2.5 rounded-[2px] bg-white" aria-hidden="true"></span></button>`
        : '';
    if (part === 'stop') return stopBtn;
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
        html: `${statusBadge}${tokensBadge}`,
    });
}