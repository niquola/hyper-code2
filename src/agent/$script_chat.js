const { agentId, initialEvents, offset: initialOffset, isStreaming: initialStreaming, inheritedCount = 0 } = window.__init;
let offset = initialOffset;

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");
const usageEl = document.getElementById("context-usage");
let renderedCount = 0;

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

function withActions(node, idx, allowOne = true, allowFrom = true) {
    const wrap = document.createElement('div');
    wrap.className = 'group relative';
    const actions = document.createElement('div');
    actions.className = 'absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1';
    if (allowOne) actions.appendChild(deleteButton('delete', idx, 'one'));
    if (allowFrom) actions.appendChild(deleteButton('from here', idx, 'from'));
    wrap.appendChild(actions);
    wrap.appendChild(node);
    messagesEl.appendChild(wrap);
    wrap.scrollIntoView({ block: 'end' });
    return wrap;
}

function deleteButton(label, idx, mode) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-[10px] px-1.5 py-0.5 rounded border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50';
    btn.textContent = label;
    let armed = false;
    let timer = null;
    const reset = () => {
        armed = false;
        btn.textContent = label;
        btn.classList.remove('border-red-300', 'text-red-700', 'bg-red-50');
        if (timer) { clearTimeout(timer); timer = null; }
    };
    btn.addEventListener('mouseleave', () => { if (armed) reset(); });
    btn.addEventListener('click', async () => {
        if (!armed) {
            armed = true;
            btn.textContent = 'sure?';
            btn.classList.add('border-red-300', 'text-red-700', 'bg-red-50');
            timer = setTimeout(reset, 2000);
            return;
        }
        const fd = new FormData();
        fd.set('idx', String(idx));
        fd.set('mode', mode);
        const res = await fetch('/agent/' + encodeURIComponent(agentId) + '/messages/delete', { method: 'POST', body: fd });
        if (res.ok || res.status === 303) location.reload();
        else {
            reset();
            alert((await res.json()).error || 'delete failed');
        }
    });
    return btn;
}

function addUser(t, idx) {
    const d = document.createElement('div');
    d.className = 'bg-gray-900 text-white rounded-lg px-4 py-3 whitespace-pre-wrap break-words';
    d.textContent = t;
    withActions(d, idx, true, true);
}
function addError(t) { bubble("bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words", t); }
function addPending(t) { return bubble("bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3", t); }

function fmtTok(n) {
    if (n == null) return "—";
    if (n < 1000) return String(n);
    const v = Math.round(n / 100) / 10;
    return String(v).replace(/\.0$/, "") + "k";
}

function updateUsage(usage) {
    if (!usageEl) return;
    if (!usage) return;
    const inTok = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens;
    const total = usage.total_tokens ?? usage.totalTokens;
    if (inTok != null && total != null) usageEl.textContent = "ctx: " + fmtTok(inTok) + " · total: " + fmtTok(total);
    else if (inTok != null) usageEl.textContent = "ctx: " + fmtTok(inTok);
    else if (total != null) usageEl.textContent = "ctx total: " + fmtTok(total);
    else usageEl.textContent = "ctx: —";
}

function addAssistant(ev, idx) {
    const d = document.createElement("div");
    d.className = "assistant bg-gray-50 rounded-lg px-4 py-3 prose prose-sm max-w-none prose-pre:my-2 prose-p:my-1 prose-headings:my-2";
    if (ev.html) d.innerHTML = ev.html; else d.textContent = ev.text || "";
    updateUsage(ev.usage);
    withActions(d, idx, true, true);
}

function addToolCall(tc) {
    const d = document.createElement("div");
    d.className = "tool border border-gray-200 rounded-lg overflow-hidden text-xs leading-snug" + (tc.isError ? " ring-1 ring-red-200" : "");
    const argsHtml = tc.argsHtml || ('<pre><code>' + esc(JSON.stringify(tc.args)) + '</code></pre>');
    const resultHtml = tc.resultHtml || ('<pre><code>' + esc(String(tc.result)) + '</code></pre>');
    d.innerHTML = '<div class="bg-white px-4 py-2">' + argsHtml + '</div>' + '<div class="bg-gray-50 border-t border-gray-200 px-4 py-2 text-gray-700">' + resultHtml + '</div>';
    messagesEl.appendChild(d);
    d.scrollIntoView({ block: "end" });
}

function addThinking(ev) {
    const d = document.createElement("details");
    d.className = "text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5";
    d.innerHTML = '<summary class="cursor-pointer select-none">💭 thinking (' + (ev.text?.length ?? 0) + ' chars)</summary>' + '<pre class="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-snug text-gray-600">' + esc(ev.text || "") + '</pre>';
    messagesEl.appendChild(d);
    d.scrollIntoView({ block: "end" });
}

function renderEvents(list) {
    for (const ev of list) {
        const idx = renderedCount++;
        if (ev.type === "user") addUser(ev.text, idx);
        else if (ev.type === "thinking") addThinking(ev);
        else if (ev.type === "tool_call") addToolCall(ev);
        else if (ev.type === "assistant") addAssistant(ev, idx);
        else if (ev.type === "error") addError(ev.error);
    }
}

if (inheritedCount > 0) addPending(`inherited context: ${inheritedCount} msgs`);
renderEvents(initialEvents);
requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });

async function poll() {
    while (true) {
        await new Promise(r => setTimeout(r, 300));
        const res = await fetch("/agent/" + encodeURIComponent(agentId) + "/events?offset=" + offset);
        if (!res.ok) return;
        const data = await res.json();
        renderEvents(data.events);
        offset = data.nextOffset;
        updateUsage(data.usage);
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
        updateUsage(data.usage);
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
