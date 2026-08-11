// The agent chat as ONE self-contained column (header + transcript + composer),
// rendered by the layout into the left panel — the workspace pattern: the chat
// is harness, pages on the right are product. Extracted from the old
// /agent/:id page; the long-poll (#msg-tail), statusbar poll and chat.js
// behaviors are unchanged.
export default async function (ctx: Context, _session: Session | null, opts: { agentId: string }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const id = opts.agentId;

    // Entering the chat IS reading it: move the seen watermark before the page
    // ships, so the rail (which fetches itself right after load) already sees
    // zero unread — no badge lingering for a refresh cycle. The events.html
    // poll keeps moving it while the chat stays open.
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO kv (key, value)
              SELECT 'seen:' || ?, COALESCE(MAX(idx), -1)::text FROM messages WHERE agent_id = ?
              ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        params: [id, id],
    }).catch(() => { /* a lingering badge, not a broken page */ });
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
    const lastEvent = ((await ctx.fns.procs.db.select({
        sql: 'SELECT payload FROM events WHERE agent_id = ? AND type = \'assistant\' ORDER BY idx DESC LIMIT 1',
        params: [id],
    })) as any[])[0];
    const lastUsage = lastEvent ? JSON.parse(lastEvent.payload).usage : null;
    const statusBarHtml = await ctx.fns.agent.renderStatusBar({ agentId: id, initialUsage: lastUsage });

    const reflectionHtml = ctx.fns.ui.reflectionDropdown({ agent });
    // Switching and creating agents live in the rail on the far left — the
    // header names THIS agent and holds its controls, nothing more.
    return `
<header class="px-3 py-2 border-b border-gray-200 flex items-center gap-2 text-xs bg-gray-50">
  ${ctx.fns.ui.modelLogo({ model: agent.model })}
  <span class="font-mono font-medium text-gray-700">${esc(String(agent.title ?? id).slice(0, 40) || id)} <span class="text-gray-400">(${esc(id)})</span></span>
  ${agent.parentId ? `<span class="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5" title="fork · inherited ${inheritedCount} msgs">fork</span>` : ""}
  ${statusBarHtml}
  <span class="ml-auto flex items-center gap-1">
  ${reflectionHtml}
    <a href="/agent/${encodeURIComponent(id)}" title="agent page" class="px-1 text-gray-400 hover:text-gray-700">ⓘ</a>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/archive" hx-boost="false" class="inline">
      <button title="archive — hides from the rail, keeps the transcript" ${ctx.fns.procs.ui.attr({ action: "archive", entity: "agent", id })}
        class="px-1 text-gray-400 hover:text-gray-700"><i class="ph ph-archive"></i></button>
    </form>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/delete" hx-boost="false" class="inline" onsubmit="return confirm('delete ${esc(id)}? The transcript goes with it.')">
      <button title="delete" ${ctx.fns.procs.ui.attr({ action: "delete", entity: "agent", id })}
        class="px-1 text-gray-400 hover:text-red-600"><i class="ph ph-trash"></i></button>
    </form>
  </span>
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
<div class="border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-400">
  <details class="group">
    <summary class="cursor-pointer list-none truncate hover:text-gray-600" title="Edit status line"><i class="ph ph-note-pencil"></i> ${agent.statusLine ? esc(agent.statusLine) : 'add status line…'}${agent.statusLine && Number(agent.statusLineEvery ?? 1) > 1 ? ` · every ${Number(agent.statusLineEvery)} turns` : ''}</summary>
    <form hx-post="/agent/${encodeURIComponent(id)}/status-line" hx-swap="none" class="mt-2 flex items-end gap-2 pb-1">
      <label class="min-w-0 flex-1">Instruction
        <input name="text" maxlength="500" value="${esc(agent.statusLine ?? '')}" placeholder="Answer briefly and to the point…" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700">
      </label>
      <label class="w-20">Every
        <input name="every" type="number" min="1" max="100" value="${Math.max(1, Number(agent.statusLineEvery ?? 1))}" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700">
      </label>
      <button class="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">save</button>
    </form>
  </details>
</div>
${ctx.fns.ui.script({ target: 'agent.chat' })}`;
}
