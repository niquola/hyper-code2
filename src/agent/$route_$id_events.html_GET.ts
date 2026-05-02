// Long-poll HTML stream of events for an agent.
// Returns rendered events at offset N + a self-replacing tail div that re-fires on `load`.
// Holds the connection up to ~10s if no new events; on wake or timeout, returns delta.
//
// Why 10s and not 25s: browsers cap concurrent HTTP/1.1 connections per origin
// at ~6. With multiple agents open (sidebar + statusbar polls + long-polls per
// page) the cap was burning out — clicks to a new agent had to wait for an old
// long-poll to release. 10s keeps perceived latency invisible while halving
// the average time a connection is parked.
const LONG_POLL_MS = 10_000;

export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0') || 0);

    const agentRow = ctx.fns.db.select<any>(ctx, 'SELECT id FROM agents WHERE id = ?', [id])[0];
    if (!agentRow) return new Response('not found', { status: 404 });

    // Bun.serve's default idleTimeout is 10s; bump just this request to LONG_POLL_MS+5s.
    try { (ctx.state as any).server?.server?.timeout?.(req, Math.ceil(LONG_POLL_MS / 1000) + 5); } catch {}

    let maxIdx = ctx.fns.session.getMaxEventIdx(ctx, id);
    if (maxIdx + 1 <= offset) {
        await ctx.fns.agent.waitForEvent(ctx, id, LONG_POLL_MS, req.signal);
        maxIdx = ctx.fns.session.getMaxEventIdx(ctx, id);
    }

    const events = ctx.fns.session.getEvents(ctx, id, { fromIdx: offset });
    const eventsHtml = (await Promise.all(events.map(async (ev: any) => {
        const cached = ev.eventHtml ?? (ev.type !== 'assistant' ? ev.html : undefined);
        return cached ?? await ctx.fns.agent.renderEventHtml(ctx, ev, { agentId: id });
    }))).join('\n');

    const lastAssistant = [...events].reverse().find((ev: any) => ev?.type === 'assistant');
    const usageOob = lastAssistant?.usage
        ? `<span id="context-usage" hx-swap-oob="outerHTML" class="text-xs text-gray-500 font-mono">${formatUsage(lastAssistant.usage)}</span>`
        : '';

    const nextOffset = maxIdx + 1;
    const tailUrl = `/agent/${encodeURIComponent(id)}/events.html?offset=${nextOffset}`;
    const tail = `<div id="msg-tail" hx-get="${tailUrl}" hx-trigger="load" hx-swap="outerHTML"></div>`;

    return new Response(eventsHtml + '\n' + tail + usageOob, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}

function fmtTok(n: any): string {
    if (n == null) return '—';
    const num = Number(n);
    if (num < 1000) return String(num);
    return (Math.round(num / 100) / 10).toString().replace(/\.0$/, '') + 'k';
}

function formatUsage(usage: any): string {
    if (!usage) return 'ctx: —';
    const inTok = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens;
    const total = usage.total_tokens ?? usage.totalTokens;
    if (inTok != null && total != null) return 'ctx: ' + fmtTok(inTok) + ' · total: ' + fmtTok(total);
    if (inTok != null) return 'ctx: ' + fmtTok(inTok);
    if (total != null) return 'ctx total: ' + fmtTok(total);
    return 'ctx: —';
}
