export default function (ctx: Context, opts: { agentId: string }): string {
    const { agentId } = opts;
    const now = Date.now();
    const row = ctx.fns.db.select<any>(ctx, {
        sql: 'SELECT run_state, run_started_at, next_run_at FROM agents WHERE id = ?',
        params: [agentId],
    })[0];

    let label: string;
    let cls: string;

    if (row?.run_state === 'running') {
        const elapsed = ((now - Number(row.run_started_at ?? now)) / 1000).toFixed(1);
        label = `running · ${elapsed}s`;
        cls = 'text-blue-700 bg-blue-50 border-blue-300';
    } else if (row?.next_run_at) {
        const waits = Math.max(0, (Number(row.next_run_at) - now) / 1000).toFixed(1);
        label = `queued · ${waits}s`;
        cls = 'text-amber-700 bg-amber-50 border-amber-300';
    } else {
        label = 'idle';
        cls = 'text-gray-500 bg-gray-50 border-gray-200';
    }

    const url = `/agent/${encodeURIComponent(agentId)}/statusbar`;
    return `<span id="status-bar"
        hx-get="${url}"
        hx-trigger="every 1s"
        hx-swap="outerHTML"
        class="text-xs px-2 py-0.5 rounded border font-mono ${cls}">${label}</span>`;
}
