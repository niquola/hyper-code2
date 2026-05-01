export default function (ctx: Context, agentId: string): string {
    const now = Date.now();
    const running = ctx.fns.db.select<any>(ctx,
        'SELECT id, started_at FROM agent_jobs WHERE agent_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1',
        [agentId, 'running'],
    )[0];
    const queued = ctx.fns.db.select<any>(ctx,
        'SELECT id, debounce_until FROM agent_jobs WHERE agent_id = ? AND status = ? ORDER BY debounce_until ASC LIMIT 1',
        [agentId, 'queued'],
    )[0];

    let label: string;
    let cls: string;

    if (running) {
        const elapsed = ((now - Number(running.started_at)) / 1000).toFixed(1);
        label = `running · ${elapsed}s`;
        cls = 'text-blue-700 bg-blue-50 border-blue-300';
    } else if (queued) {
        const waitsMs = Math.max(0, Number(queued.debounce_until) - now);
        const waits = (waitsMs / 1000).toFixed(1);
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
