// Short-fetch HTML stream of events for an agent.
// Returns rendered events at offset N + a self-replacing tail div.
//
// No long-poll — the tail fires only when the browser observes an
// `agent.event_appended` SSE event for this agent (events/client.js
// dispatches `hyper-tick` on the body), or once every 10s as a safety
// fallback. This keeps each tab to a SINGLE persistent HTTP/1.1
// connection (the SSE stream itself), instead of two (SSE + long-poll).
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const url = new URL(opts.req.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0') || 0);

    const beforeRaw = url.searchParams.get('before');
    const before = beforeRaw == null ? null : Math.max(0, Number(beforeRaw) || 0);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? '100') || 100));
    const compact = url.searchParams.get('compact') === '1';
    const agentRow = ((await ctx.fns.procs.db.select({ sql: 'SELECT id FROM agents WHERE id = ?', params: [id] })) as any[])[0];
    if (!agentRow) return new Response('not found', { status: 404 });

    // `before` is the upward history pager. It returns a new head sentinel plus
    // the page, while the ordinary `offset` mode remains the live bottom tail.
    if (before != null) {
        const events = await ctx.fns.session.getEvents({ id, beforeIdx: before, limit });
        const eventsHtml = await ctx.fns.agent.renderEventsHtml({ events, agentId: id });
        const firstIdx = events.length ? Number(events[0]?.idx ?? 0) : 0;
        const head = firstIdx > 0
            ? `<div id="msg-head" hx-get="/agent/${encodeURIComponent(id)}/events.html?before=${firstIdx}&limit=${limit}" hx-trigger="load-older" hx-swap="outerHTML" class="flex justify-center py-1"><button type="button" onclick="htmx.trigger(this.parentElement, 'load-older')" class="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] text-gray-400 hover:text-gray-600">older messages</button></div>`
            : '';
        return new Response(head + eventsHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const maxIdx = await ctx.fns.session.getMaxEventIdx({ id });
    const events = await ctx.fns.session.getEvents({ id, fromIdx: offset });
    const eventsHtml = await ctx.fns.agent.renderEventsHtml({ events, agentId: id });

    // This poll only runs while the chat is on screen, so it IS the reader:
    // move the seen watermark to the newest message. The rail's unread badge
    // (session.list) counts assistant messages past this mark — an open chat
    // never accumulates unread, exactly the WhatsApp rule.
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO kv (key, value)
              SELECT 'seen:' || ?, COALESCE(MAX(idx), -1)::text FROM messages WHERE agent_id = ?
              ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        params: [id, id],
    }).catch(() => { /* a missed mark is a badge that lingers one poll */ });

    const lastAssistant = [...events].reverse().find((ev: any) => ev?.type === 'assistant');
    const usageOob = lastAssistant?.usage
        ? `<span id="context-usage" hx-swap-oob="outerHTML" class="text-xs text-gray-500 font-mono">${formatUsage(lastAssistant.usage)}</span>`
        : '';

    const nextOffset = maxIdx + 1;
    const tailUrl = `/agent/${encodeURIComponent(id)}/events.html?offset=${nextOffset}${compact ? '&compact=1' : ''}`;
    // hyper-tick: dispatched by events/client.js on agent.event_appended SSE events
    //             for this agent, so the tail refreshes only when there's something new.
    // every 10s:  belt-and-braces poll in case SSE is disconnected.
    // A live region on this agent's topic: the shared stream says when it
    // moved, the cursor says whether this tail is behind, and the interval is
    // only a watchdog.
    const tail = `<div id="msg-tail" hx-get="${tailUrl}" hx-trigger="hyper-tick from:body, hyper-live from:body, every 30s" hx-swap="outerHTML" data-live-topic="agent:${id}"></div>`;

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
