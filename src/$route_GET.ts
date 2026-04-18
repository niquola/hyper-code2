const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>hyper-code2</title>
<script src="https://cdn.tailwindcss.com?plugins=typography"></script>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .shiki { background: transparent !important; }
  .assistant pre.shiki { padding: .6em .8em; border-radius: 6px; overflow-x: auto; margin: .4em 0; font-size: 12.5px; line-height: 1.45; }
  .tool pre.shiki { padding: 0; margin: 0; overflow-x: auto; }
</style>
</head>
<body class="bg-white text-gray-900 text-sm h-screen">
<div class="flex h-screen">
  <aside class="w-64 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
    <div class="px-4 py-3 flex items-center justify-between border-b border-gray-200">
      <span class="font-semibold text-gray-700">agents</span>
      <button id="new-btn" class="text-xs px-2 py-0.5 border border-gray-300 rounded bg-white hover:bg-gray-100">+ new</button>
    </div>
    <div id="new-form" class="hidden px-4 py-3 border-b border-gray-200 space-y-2">
      <input id="new-model" placeholder="model" class="w-full px-2 py-1 border border-gray-300 rounded text-xs">
      <textarea id="new-prompt" rows="3" placeholder="system prompt (optional — default used if empty)" class="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono resize-y"></textarea>
      <div class="flex gap-2">
        <button id="new-create" class="flex-1 text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700">create</button>
        <button id="new-cancel" class="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100">cancel</button>
      </div>
    </div>
    <div id="agents-list" class="flex-1 overflow-y-auto"></div>
  </aside>

  <main class="flex-1 flex flex-col overflow-hidden">
    <header class="px-6 py-3 border-b border-gray-200 flex items-center gap-3 text-sm">
      <span id="current-label" class="font-semibold text-gray-600">no agent</span>
      <span id="current-model" class="text-xs text-gray-400 font-mono"></span>
      <div class="ml-auto flex gap-2">
        <button id="stop" type="button" class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">stop</button>
        <button id="delete" type="button" class="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">delete</button>
      </div>
    </header>
    <div id="messages" class="flex-1 overflow-y-auto px-6 py-4 space-y-2"></div>
    <form id="form" class="flex gap-2 p-4 border-t border-gray-200">
      <textarea id="input" rows="2" placeholder="type — ⌘/Ctrl-Enter to send"
        class="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400" disabled></textarea>
      <button id="send" class="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait" disabled>Send</button>
    </form>
  </main>
</div>
<script>
const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");
const listEl = document.getElementById("agents-list");
const currentLabel = document.getElementById("current-label");
const currentModel = document.getElementById("current-model");
const newBtn = document.getElementById("new-btn");
const newForm = document.getElementById("new-form");
const newModel = document.getElementById("new-model");
const newPrompt = document.getElementById("new-prompt");
const newCreate = document.getElementById("new-create");
const newCancel = document.getElementById("new-cancel");

let currentId = localStorage.getItem("hyper.currentAgent") || null;
let offset = 0;
let polling = false;

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[ch]);
}

function bubble(cls, text) {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  messagesEl.appendChild(d);
  d.scrollIntoView({ block: "end" });
  return d;
}

function addUser(text) { bubble("bg-gray-900 text-white rounded-lg px-4 py-3 whitespace-pre-wrap break-words", text); }
function addError(text) { bubble("bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words", text); }
function addPending(text) { return bubble("bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3", text); }

function addAssistant(ev) {
  const d = document.createElement("div");
  d.className = "assistant bg-gray-50 rounded-lg px-4 py-3 prose prose-sm max-w-none prose-pre:my-2 prose-p:my-1 prose-headings:my-2";
  if (ev.html) d.innerHTML = ev.html; else d.textContent = ev.text || "";
  messagesEl.appendChild(d);
  d.scrollIntoView({ block: "end" });
}

function addToolCall(tc) {
  const d = document.createElement("div");
  d.className = "tool border border-gray-200 rounded-lg overflow-hidden text-xs leading-snug" + (tc.isError ? " ring-1 ring-red-200" : "");
  const argsHtml = tc.argsHtml || ('<pre><code>' + esc(JSON.stringify(tc.args)) + '</code></pre>');
  const resultHtml = tc.resultHtml || ('<pre><code>' + esc(String(tc.result)) + '</code></pre>');
  d.innerHTML =
    '<div class="bg-white px-4 py-2">' + argsHtml + '</div>' +
    '<div class="bg-gray-50 border-t border-gray-200 px-4 py-2 text-gray-700">' + resultHtml + '</div>';
  messagesEl.appendChild(d);
  d.scrollIntoView({ block: "end" });
}

function renderEvents(events) {
  for (const ev of events) {
    if (ev.type === "user") addUser(ev.text);
    else if (ev.type === "tool_call") addToolCall(ev);
    else if (ev.type === "assistant") addAssistant(ev);
    else if (ev.type === "error") addError(ev.error);
  }
}

async function refreshAgentsList() {
  const res = await fetch("/agents");
  const { agents } = await res.json();
  listEl.innerHTML = "";
  if (agents.length === 0) {
    listEl.innerHTML = '<div class="px-4 py-3 text-xs text-gray-400">no agents yet — hit "+ new"</div>';
    return;
  }
  for (const a of agents) {
    const row = document.createElement("button");
    const active = a.id === currentId;
    row.className = "w-full text-left px-4 py-2 border-b border-gray-200 text-xs hover:bg-gray-100 " + (active ? "bg-white font-semibold" : "");
    row.innerHTML =
      '<div class="truncate">' + esc(a.title) + '</div>' +
      '<div class="text-gray-400 font-mono mt-0.5">' + esc(a.id) + ' · ' + a.turns + ' turns' + (a.isStreaming ? ' · ●' : '') + '</div>';
    row.addEventListener("click", () => selectAgent(a.id));
    listEl.appendChild(row);
  }
}

async function selectAgent(id) {
  currentId = id;
  localStorage.setItem("hyper.currentAgent", id);
  offset = 0;
  messagesEl.innerHTML = "";
  input.disabled = false;
  send.disabled = false;
  await refreshAgentsList();
  await loadCurrent();
}

async function loadCurrent() {
  if (!currentId) return;
  const res = await fetch("/agents/" + encodeURIComponent(currentId) + "?offset=0");
  if (!res.ok) {
    currentLabel.textContent = "agent gone";
    currentModel.textContent = "";
    currentId = null;
    localStorage.removeItem("hyper.currentAgent");
    return;
  }
  const data = await res.json();
  currentLabel.textContent = data.id;
  currentModel.textContent = data.model;
  messagesEl.innerHTML = "";
  renderEvents(data.events);
  offset = data.nextOffset;
  if (data.isStreaming && !polling) pollCurrent();
}

async function pollCurrent() {
  polling = true;
  try {
    while (currentId) {
      await new Promise(r => setTimeout(r, 300));
      const res = await fetch("/agents/" + encodeURIComponent(currentId) + "?offset=" + offset);
      if (!res.ok) return;
      const data = await res.json();
      renderEvents(data.events);
      offset = data.nextOffset;
      if (!data.isStreaming) return;
    }
  } finally { polling = false; }
}

async function createAgent() {
  const body = {};
  if (newModel.value.trim()) body.model = newModel.value.trim();
  if (newPrompt.value.trim()) body.systemPrompt = newPrompt.value;
  const res = await fetch("/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const { id } = await res.json();
  newForm.classList.add("hidden");
  newModel.value = "";
  newPrompt.value = "";
  await selectAgent(id);
}

newBtn.addEventListener("click", () => newForm.classList.toggle("hidden"));
newCancel.addEventListener("click", () => newForm.classList.add("hidden"));
newCreate.addEventListener("click", createAgent);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentId) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  send.disabled = true;
  const pending = addPending("thinking...");
  try {
    await fetch("/agents/" + encodeURIComponent(currentId), { method: "POST", body: text });
    const res = await fetch("/agents/" + encodeURIComponent(currentId) + "?offset=" + offset);
    const data = await res.json();
    pending.remove();
    renderEvents(data.events);
    offset = data.nextOffset;
    await refreshAgentsList();
    if (data.isStreaming) {
      const p = addPending("thinking...");
      await pollCurrent();
      p.remove();
      await refreshAgentsList();
    }
  } catch (err) {
    pending.remove();
    addError(err.message);
  } finally {
    send.disabled = false;
    input.focus();
  }
});

document.getElementById("delete").addEventListener("click", async () => {
  if (!currentId || !confirm("delete agent " + currentId + "?")) return;
  await fetch("/agents/" + encodeURIComponent(currentId), { method: "DELETE" });
  currentId = null;
  localStorage.removeItem("hyper.currentAgent");
  messagesEl.innerHTML = "";
  currentLabel.textContent = "no agent";
  currentModel.textContent = "";
  input.disabled = true;
  send.disabled = true;
  await refreshAgentsList();
});

document.getElementById("stop").addEventListener("click", async () => {
  if (!currentId) return;
  await fetch("/agents/" + encodeURIComponent(currentId) + "/stop", { method: "POST" });
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.requestSubmit();
});

(async function init() {
  await refreshAgentsList();
  if (currentId) await selectAgent(currentId);
  setInterval(refreshAgentsList, 2000);
})();
</script>
</body>
</html>`;

export default async function (_ctx: Context, _session: any, _req: Request) {
    return new Response(HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
