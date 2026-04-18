export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        return new Response("Not Found", { status: 404 });
    }

    const initialEventsJSON = JSON.stringify(agent.events);
    const initialOffset = agent.events.length;
    const isStreaming = agent.isStreaming;

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
<script>
const AGENT_ID = ${JSON.stringify(id)};
const initialEvents = ${initialEventsJSON};
let offset = ${initialOffset};
let isStreaming = ${isStreaming ? "true" : "false"};

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");

function esc(s){return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[ch]))}
function bubble(c,t){const d=document.createElement("div");d.className=c;d.textContent=t;messagesEl.appendChild(d);d.scrollIntoView({block:"end"});return d}
function addUser(t){bubble("bg-gray-900 text-white rounded-lg px-4 py-3 whitespace-pre-wrap break-words",t)}
function addError(t){bubble("bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words",t)}
function addPending(t){return bubble("bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3",t)}
function addAssistant(ev){const d=document.createElement("div");d.className="assistant bg-gray-50 rounded-lg px-4 py-3 prose prose-sm max-w-none prose-pre:my-2 prose-p:my-1 prose-headings:my-2";if(ev.html)d.innerHTML=ev.html;else d.textContent=ev.text||"";messagesEl.appendChild(d);d.scrollIntoView({block:"end"})}
function addToolCall(tc){const d=document.createElement("div");d.className="tool border border-gray-200 rounded-lg overflow-hidden text-xs leading-snug"+(tc.isError?" ring-1 ring-red-200":"");const argsHtml=tc.argsHtml||('<pre><code>'+esc(JSON.stringify(tc.args))+'</code></pre>');const resultHtml=tc.resultHtml||('<pre><code>'+esc(String(tc.result))+'</code></pre>');d.innerHTML='<div class="bg-white px-4 py-2">'+argsHtml+'</div><div class="bg-gray-50 border-t border-gray-200 px-4 py-2 text-gray-700">'+resultHtml+'</div>';messagesEl.appendChild(d);d.scrollIntoView({block:"end"})}
function renderEvents(list){for(const ev of list){if(ev.type==="user")addUser(ev.text);else if(ev.type==="tool_call")addToolCall(ev);else if(ev.type==="assistant")addAssistant(ev);else if(ev.type==="error")addError(ev.error)}}

renderEvents(initialEvents);

async function poll() {
  while (true) {
    await new Promise(r => setTimeout(r, 300));
    const res = await fetch("/agent/" + encodeURIComponent(AGENT_ID) + "/events?offset=" + offset);
    if (!res.ok) return;
    const data = await res.json();
    renderEvents(data.events);
    offset = data.nextOffset;
    if (!data.isStreaming) return;
  }
}
if (isStreaming) poll();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  send.disabled = true;
  const pending = addPending("thinking...");
  try {
    await fetch("/agent/" + encodeURIComponent(AGENT_ID), { method: "POST", body: text });
    const res = await fetch("/agent/" + encodeURIComponent(AGENT_ID) + "/events?offset=" + offset);
    const data = await res.json();
    pending.remove();
    renderEvents(data.events);
    offset = data.nextOffset;
    if (data.isStreaming) {
      const p = addPending("thinking...");
      await poll();
      p.remove();
    }
  } catch (err) {
    pending.remove();
    addError(err.message);
  } finally {
    send.disabled = false;
    input.focus();
  }
});

input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
input.focus();
</script>`;

    const html = ctx.fns.ui.layout(ctx, { currentId: id, title: id, main });
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
