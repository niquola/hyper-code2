export default async function (ctx: Context, _session: Session | null, opts: { agentId: string; initialUsage?: any }): Promise<string> {
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
        cls = 'text-blue-700 bg-blue-50 border-blue-300';
    } else if (row?.next_run_at) {
        const waits = Math.max(0, (Number(row.next_run_at) - now) / 1000).toFixed(1);
        label = `queued · ${waits}s`;
        cls = 'text-amber-700 bg-amber-50 border-amber-300';
    } else if (row?.last_error) {
        // A failed run does NOT auto-retry (by design) — without this badge it
        // looks like a hang. The next user message retries; say so.
        label = 'error';
        cls = 'text-red-700 bg-red-50 border-red-300';
    } else {
        label = 'idle';
        cls = 'text-gray-500 bg-gray-50 border-gray-200';
    }

    const url = `/agent/${encodeURIComponent(agentId)}/statusbar`;
    const esc = (t: any) => ctx.fns.procs.ui.escape({ text: t });
    const statusBadge = row?.last_error && row?.run_state !== 'running'
        ? `<span class="text-xs px-2 py-0.5 rounded border font-mono ${cls} max-w-[16rem] truncate inline-block align-bottom" title="${esc(String(row.last_error))} — send a message to retry">error: ${esc(String(row.last_error).slice(0, 48))}</span>`
        : `<span class="text-xs px-2 py-0.5 rounded border font-mono inline-flex items-center gap-1 ${cls}" title="${row?.run_state === 'running' ? 'running' : esc(label)}">${label}</span>`;
    const tokensBadge = usage ? `<span title="context tokens" class="text-xs px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-600 font-mono">${(((usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)) / 1000).toFixed(1)}k</span>` : '';
    // Stop exists only while there is something to stop — a running turn or a
    // queued one. It lives in this fragment because the fragment re-renders
    // every second: the button appears with the run and leaves with it.
    const busy = row?.run_state === 'running' || !!row?.next_run_at;
    const stopBtn = busy
        ? `<form method="POST" action="/agent/${encodeURIComponent(agentId)}/stop" class="inline"><button title="stop this run" ${ctx.fns.procs.ui.attr({ action: "stop", entity: "agent", id: agentId })} class="text-xs px-1 py-0.5 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50"><i class="ph ph-stop-circle align-middle"></i></button></form>`
        : '';
    return `<div id="status-bar" hx-get="${url}" hx-trigger="every 1s" hx-swap="outerHTML" class="flex items-center gap-2">${statusBadge}${tokensBadge}${stopBtn}</div>`;
}