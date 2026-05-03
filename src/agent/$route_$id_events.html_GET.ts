// Short-fetch HTML stream of events for an agent.
// Returns rendered events at offset N + a self-replacing tail div.
//
// No long-poll — the tail fires only when the browser observes an
// `agent.event_appended` SSE event for this agent (events/client.js
// dispatches `hyper-tick` on the body), or once every 10s as a safety
// fallback. This keeps each tab to a SINGLE persistent HTTP/1.1
// connection (the SSE stream itself), instead of two (SSE + long-poll).
export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0') || 0);

    const agentRow = ctx.fns.db.select<any>(ctx, { sql: 'SELECT id FROM agents WHERE id = ?', params: [id] })[0];
    if (!agentRow) return new Response('not found', { status: 404 });

    const maxIdx = ctx.fns.session.getMaxEventIdx(ctx, { id });
    const events = ctx.fns.session.getEvents(ctx, { id, fromIdx: offset });
    const eventsHtml = (await Promise.all(events.map(async (ev: any) => {
        const cached = ev.eventHtml ?? (ev.type !== 'assistant' ? ev.html : undefined);
        return cached ?? await ctx.fns.agent.renderEventHtml(ctx, { event: ev, agentId: id });
    }))).join('\n');

    const lastAssistant = [...events].reverse().find((ev: any) => ev?.type === 'assistant');
    const usageOob = lastAssistant?.usage
        ? `<span id="context-usage" hx-swap-oob="outerHTML" class="text-xs text-gray-500 font-mono">${formatUsage(lastAssistant.usage)}</span>`
        : '';

    const nextOffset = maxIdx + 1;
    const tailUrl = `/agent/${encodeURIComponent(id)}/events.html?offset=${nextOffset}`;
    // hyper-tick: dispatched by events/client.js on agent.event_appended SSE events
    //             for this agent, so the tail refreshes only when there's something new.
    // every 10s:  belt-and-braces poll in case SSE is disconnected.
    const tail = `<div id="msg-tail" hx-get="${tailUrl}" hx-trigger="hyper-tick from:body, every 10s" hx-swap="outerHTML"></div>`;

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
