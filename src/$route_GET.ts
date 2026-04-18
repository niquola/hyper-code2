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
<body class="bg-white text-gray-900 text-sm">
<div class="max-w-3xl mx-auto px-4 py-8">
  <h1 class="flex items-baseline gap-2 text-gray-600 text-base font-semibold mb-4">
    hyper-code2 · evalCode agent
    <button id="stop" type="button" class="text-xs font-normal px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">stop</button>
    <button id="reset" type="button" class="text-xs font-normal px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50">reset</button>
  </h1>
  <div id="messages" class="mb-4 min-h-[10em] space-y-2"></div>
  <form id="form" class="flex gap-2">
    <textarea id="input" rows="2" placeholder="Try: what is 15% of 2400?  or  first 10 fibonacci numbers"
      class="flex-1 px-3 py-2 border border-gray-300 rounded font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"></textarea>
    <button id="send" class="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait">Send</button>
  </form>
</div>
<script>
const messages = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");
const resetBtn = document.getElementById("reset");
let offset = 0;

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[ch]);
}

function bubble(cls, text) {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  messages.appendChild(d);
  d.scrollIntoView({ block: "end" });
  return d;
}

function addUser(text) {
  bubble("bg-gray-900 text-white rounded-lg px-4 py-3 whitespace-pre-wrap break-words", text);
}

function addError(text) {
  bubble("bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words", text);
}

function addPending(text) {
  return bubble("bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3", text);
}

function addAssistant(ev) {
  const d = document.createElement("div");
  d.className = "assistant bg-gray-50 rounded-lg px-4 py-3 prose prose-sm max-w-none prose-pre:my-2 prose-p:my-1 prose-headings:my-2";
  if (ev.html) d.innerHTML = ev.html;
  else d.textContent = ev.text || "";
  messages.appendChild(d);
  d.scrollIntoView({ block: "end" });
}

function addToolCall(tc) {
  const d = document.createElement("div");
  d.className = "tool border border-gray-200 rounded-lg overflow-hidden text-xs leading-snug" + (tc.isError ? " ring-1 ring-red-200" : "");
  const argsHtml = tc.argsHtml || ('<pre><code>' + esc(JSON.stringify(tc.args)) + '</code></pre>');
  const resultHtml = tc.resultHtml || ('<pre><code>' + esc(String(tc.result)) + '</code></pre>');
  d.innerHTML =
    '<div class="args bg-white px-4 py-2">' + argsHtml + '</div>' +
    '<div class="result bg-gray-50 border-t border-gray-200 px-4 py-2 text-gray-700">' + resultHtml + '</div>';
  messages.appendChild(d);
  d.scrollIntoView({ block: "end" });
}

function render(events) {
  for (const ev of events) {
    if (ev.type === "user") addUser(ev.text);
    else if (ev.type === "tool_call") addToolCall(ev);
    else if (ev.type === "assistant") addAssistant(ev);
    else if (ev.type === "error") addError(ev.error);
  }
}

async function loadHistory() {
  try {
    const res = await fetch("/agent?offset=0");
    const data = await res.json();
    render(data.events || []);
    offset = data.nextOffset || 0;
  } catch (e) {}
}

async function poll() {
  while (true) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch("/agent?offset=" + offset);
      const data = await res.json();
      render(data.events || []);
      offset = data.nextOffset || offset;
      if (!data.isStreaming) return;
    } catch (e) { return; }
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  send.disabled = true;
  const pending = addPending("thinking...");
  try {
    const res = await fetch("/agent", { method: "POST", body: text });
    const data = await res.json();
    if (data.error) { pending.remove(); addError(data.error); return; }
    const res2 = await fetch("/agent?offset=" + offset);
    const data2 = await res2.json();
    pending.remove();
    render(data2.events || []);
    offset = data2.nextOffset || offset;
    if (data2.isStreaming) {
      const pending2 = addPending("thinking...");
      await poll();
      pending2.remove();
    }
  } catch (err) {
    pending.remove();
    addError(err.message);
  } finally {
    send.disabled = false;
    input.focus();
  }
});

resetBtn.addEventListener("click", async () => {
  if (!confirm("reset conversation?")) return;
  await fetch("/agent", { method: "DELETE" });
  messages.innerHTML = "";
  offset = 0;
});

document.getElementById("stop").addEventListener("click", async () => {
  await fetch("/agent/stop", { method: "POST" });
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.requestSubmit();
});
input.focus();
loadHistory();
</script>
</body>
</html>`;

export default async function (_ctx: Context, _session: any, _req: Request) {
    return new Response(HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
