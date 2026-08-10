// The agent chat as ONE self-contained column (header + transcript + composer),
// rendered by the layout into the left panel — the workspace pattern: the chat
// is harness, pages on the right are product. Extracted from the old
// /agent/:id page; the long-poll (#msg-tail), statusbar poll and chat.js
// behaviors are unchanged.
export default async function (ctx: Context, _session: Session | null, opts: { agentId: string }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const id = opts.agentId;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = (await ctx.fns.session?.load?.({ id })) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return `<div class="p-4 text-sm text-gray-400">agent ${esc(id)} not found</div>`;

    const events = await ctx.fns.session.getEvents({ id });
    const maxIdx = await ctx.fns.session.getMaxEventIdx({ id });
    const inheritedCount = agent.parentId
        ? (await ctx.fns.session.getFullMessages({ id })).length - (await ctx.fns.session.getMessages({ id })).length
        : 0;
    const stateRow = ((await ctx.fns.procs.db.select({
        sql: 'SELECT run_state, next_run_at FROM agents WHERE id = ?',
        params: [id],
    })) as any[])[0];
    const isStreaming = stateRow?.run_state === 'running' || !!stateRow?.next_run_at;
    const initJson = JSON.stringify({ agentId: id, inheritedCount, offset: maxIdx + 1, isStreaming }).replaceAll('<', '\\u003c');

    const eventsHtml = await ctx.fns.agent.renderEventsHtml({ events, agentId: id });
    const agents = await ctx.fns.session.list({});
    const lastEvent = ((await ctx.fns.procs.db.select({
        sql: 'SELECT payload FROM events WHERE agent_id = ? AND type = \'assistant\' ORDER BY idx DESC LIMIT 1',
        params: [id],
    })) as any[])[0];
    const lastUsage = lastEvent ? JSON.parse(lastEvent.payload).usage : null;
    const statusBarHtml = await ctx.fns.agent.renderStatusBar({ agentId: id, initialUsage: lastUsage });
    const options = agents.map((a: any) =>
        `<option value="${esc(a.id)}"${a.id === id ? " selected" : ""}>${esc(a.id)} · ${esc(String(a.title ?? "").slice(0, 32))}</option>`).join("");

    return `
<header class="px-3 py-2 border-b border-gray-200 flex items-center gap-2 text-xs bg-gray-50">
  <select ${ctx.fns.procs.ui.attr({ role: "agent-picker" })} onchange="location.href='/agent/'+encodeURIComponent(this.value)"
          class="max-w-[11rem] truncate rounded border border-gray-300 bg-white px-1.5 py-1 text-xs font-mono">${options}</select>
  <a href="/agent/new" title="new agent" class="px-1.5 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100">+</a>
  ${agent.parentId ? `<span class="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5" title="fork · inherited ${inheritedCount} msgs">fork</span>` : ""}
  ${statusBarHtml}
  <a href="/agent/${encodeURIComponent(id)}" title="agent page" class="ml-auto text-gray-400 hover:text-gray-700">ⓘ</a>
  <form method="POST" action="/agent/${encodeURIComponent(id)}/stop" class="inline">
    <button title="stop" class="px-1.5 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100">■</button>
  </form>
</header>
<div id="messages" class="flex-1 overflow-y-auto px-3 py-3 space-y-2">${eventsHtml}
<div id="msg-tail" hx-get="/agent/${encodeURIComponent(id)}/events.html?offset=${maxIdx + 1}" hx-trigger="load" hx-swap="outerHTML"></div>
</div>
<form id="form"
      ${ctx.fns.procs.ui.attr({ form: "chat" })}
      class="flex gap-2 p-3 border-t border-gray-200"
      hx-post="/agent/${encodeURIComponent(id)}?debounceSeconds=0.1"
      hx-trigger="submit"
      hx-swap="none"
      hx-on::after-request="this.elements.input.value=''; this.elements.input.focus();">
  <textarea id="input" name="text" rows="2" placeholder="type — Enter to send"
    class="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"></textarea>
</form>
<script>window.__init = ${initJson};</script>
${ctx.fns.ui.script({ target: 'agent.chat' })}`;
}
