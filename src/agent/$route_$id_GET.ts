export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = ctx.fns.session?.load?.(ctx, { id }) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return new Response('Not Found', { status: 404 });

    const events = ctx.fns.session.getEvents(ctx, { id });
    const maxIdx = ctx.fns.session.getMaxEventIdx(ctx, { id });
    const inheritedCount = agent.parentId
        ? ctx.fns.session.getFullMessages(ctx, { id }).length - ctx.fns.session.getMessages(ctx, { id }).length
        : 0;
    const stateRow = ctx.fns.db.select<any>(ctx, {
        sql: 'SELECT run_state, next_run_at FROM agents WHERE id = ?',
        params: [id],
    })[0];
    const isStreaming = stateRow?.run_state === 'running' || !!stateRow?.next_run_at;
    const init = {
        agentId: id,
        inheritedCount,
        offset: maxIdx + 1,
        isStreaming,
    };
    const initJson = JSON.stringify(init).replace(/</g, '\u003c');

    const eventsHtml = (await Promise.all(events.map(async (ev: any) => {
        const cached = ev.eventHtml ?? (ev.type !== 'assistant' ? ev.html : undefined);
        return cached ?? await ctx.fns.agent.renderEventHtml(ctx, { event: ev, agentId: id });
    }))).join('\n');

    const lastAssistant = [...events].reverse().find((ev: any) => ev?.type === 'assistant');
    const initialUsageText = formatUsage(lastAssistant?.usage ?? null);

    const main = `
<header class="px-6 py-3 border-b border-gray-200 flex items-center gap-3 text-sm">
  <span class="font-semibold text-gray-700">${esc(id)}</span>
  ${agent.parentId ? `<span class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">fork · inherited ${inheritedCount} msgs</span>` : ''}
  <span class="text-xs text-gray-400 font-mono">${esc(agent.model)}</span>
  <span id="context-usage" class="text-xs text-gray-500 font-mono">${esc(initialUsageText)}</span>
  ${ctx.fns.agent.renderStatusBar(ctx, { agentId: id })}
  <div class="ml-auto flex gap-2">
    <form method="POST" action="/agent/${encodeURIComponent(id)}/stop" class="inline">
      <button class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">stop</button>
    </form>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/fork" class="inline">
      <button class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">fork</button>
    </form>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/archive" class="inline">
      <button class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">archive</button>
    </form>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/delete" class="inline" onsubmit="return confirm('delete this agent?')">
      <button class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">delete</button>
    </form>
  </div>
</header>
<div id="messages" class="flex-1 overflow-y-auto px-6 py-4 space-y-2">${eventsHtml}
<div id="msg-tail" hx-get="/agent/${encodeURIComponent(id)}/events.html?offset=${maxIdx + 1}" hx-trigger="load" hx-swap="outerHTML"></div>
</div>
<form id="form"
      class="flex gap-2 p-4 border-t border-gray-200"
      hx-post="/agent/${encodeURIComponent(id)}?debounceSeconds=5"
      hx-trigger="submit"
      hx-swap="none"
      hx-on::after-request="this.elements.input.value=''; this.elements.input.focus();">
  <textarea id="input" name="text" rows="2" placeholder="type — Enter to send"
    class="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"></textarea>
</form>
<script>window.__init = ${initJson};</script>
${ctx.fns.ui.script(ctx, { target: 'agent.chat' })}`;

    return { currentId: id, title: id, main };
}

function esc(s: any): string {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
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
