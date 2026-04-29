const { agentId, initialEvents, offset: initialOffset, isStreaming: initialStreaming } = window.__init;
let offset = initialOffset;

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");

function esc(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function bubble(cls, text) {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    messagesEl.appendChild(d);
    d.scrollIntoView({ block: "end" });
    return d;
}

function addUser(t) { bubble("bg-gray-900 text-white rounded-lg px-4 py-3 whitespace-pre-wrap break-words", t); }
function addError(t) { bubble("bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words", t); }
function addPending(t) { return bubble("bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3", t); }

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

function addThinking(ev) {
    const d = document.createElement("details");
    d.className = "text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5";
    d.innerHTML =
        '<summary class="cursor-pointer select-none">💭 thinking (' + (ev.text?.length ?? 0) + ' chars)</summary>' +
        '<pre class="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-snug text-gray-600">' + esc(ev.text || "") + '</pre>';
    messagesEl.appendChild(d);
    d.scrollIntoView({ block: "end" });
}

function renderEvents(list) {
    for (const ev of list) {
        if (ev.type === "user") addUser(ev.text);
        else if (ev.type === "thinking") addThinking(ev);
        else if (ev.type === "tool_call") addToolCall(ev);
        else if (ev.type === "assistant") addAssistant(ev);
        else if (ev.type === "error") addError(ev.error);
    }
}

renderEvents(initialEvents);
// Force scroll to the very bottom after initial render (browser scroll restoration may override scrollIntoView).
requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });

async function poll() {
    while (true) {
        await new Promise(r => setTimeout(r, 300));
        const res = await fetch("/agent/" + encodeURIComponent(agentId) + "/events?offset=" + offset);
        if (!res.ok) return;
        const data = await res.json();
        renderEvents(data.events);
        offset = data.nextOffset;
        if (!data.isStreaming) return;
    }
}

if (initialStreaming) poll();

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    if (send) send.disabled = true;
    const pending = addPending("thinking...");
    try {
        await fetch("/agent/" + encodeURIComponent(agentId), { method: "POST", body: text });
        const res = await fetch("/agent/" + encodeURIComponent(agentId) + "/events?offset=" + offset);
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
        if (send) send.disabled = false;
        input.focus();
    }
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});
input.focus();
