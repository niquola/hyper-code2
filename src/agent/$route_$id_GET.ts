export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (!agent) return new Response("Not Found", { status: 404 });

    const init = {
        agentId: id,
        initialEvents: agent.events,
        offset: agent.events.length,
        isStreaming: agent.isStreaming,
    };
    const initJson = JSON.stringify(init).replace(/</g, "\\u003c");

    const main = `
<header class="px-6 py-3 border-b border-gray-200 flex items-center gap-3 text-sm">
  <span class="font-semibold text-gray-700">${esc(id)}</span>
  <span class="text-xs text-gray-400 font-mono">${esc(agent.model)}</span>
  <div class="ml-auto flex gap-2">
    <form method="POST" action="/agent/${encodeURIComponent(id)}/stop" class="inline">
      <button class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">stop</button>
    </form>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/delete" class="inline" onsubmit="return confirm('delete this agent?')">
      <button class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">delete</button>
    </form>
  </div>
</header>
<div id="messages" class="flex-1 overflow-y-auto px-6 py-4 space-y-2"></div>
<form id="form" class="flex gap-2 p-4 border-t border-gray-200">
  <textarea id="input" rows="2" placeholder="type — ⌘/Ctrl-Enter to send"
    class="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"></textarea>
  <button id="send" class="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait">Send</button>
</form>
<script>window.__init = ${initJson};</script>
${ctx.fns.ui.script(ctx, "agent.chat")}`;

    return { currentId: id, title: id, main };
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
