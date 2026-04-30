const { agentId, offset: initialOffset, isStreaming: initialStreaming, inheritedCount = 0 } = window.__init;
let offset = initialOffset;

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");
const usageEl = document.getElementById("context-usage");
let thinkingOverlayEl = null;
let thinkingHideTimer = null;
let liveThinkingText = '';

function bubble(cls, text) {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    messagesEl.appendChild(d);
    d.scrollIntoView({ block: "end" });
    return d;
}

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
}

function ensureThinkingOverlay() {
    if (thinkingOverlayEl) return thinkingOverlayEl;
    const el = document.createElement('div');
    el.id = 'thinking-overlay';
    el.className = 'fixed right-4 top-4 z-50 max-w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-blue-200 bg-white/75 backdrop-blur shadow-lg px-4 py-3 text-sm text-gray-700 opacity-0 pointer-events-none transition-opacity duration-300';
    el.innerHTML = '<div class="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1">thinking</div><pre class="whitespace-pre-wrap break-words font-mono text-[11px] leading-snug max-h-[40vh] overflow-auto"></pre>';
    document.body.appendChild(el);
    thinkingOverlayEl = el;
    return el;
}

function showThinking(text) {
    if (!text) return;
    const el = ensureThinkingOverlay();
    const pre = el.querySelector('pre');
    if (pre) pre.textContent = text;
    if (thinkingHideTimer) {
        clearTimeout(thinkingHideTimer);
        thinkingHideTimer = null;
    }
    el.classList.remove('opacity-0');
    el.classList.add('opacity-100');
}

function hideThinkingSoon() {
    if (!thinkingOverlayEl) return;
    if (thinkingHideTimer) clearTimeout(thinkingHideTimer);
    thinkingHideTimer = setTimeout(() => {
        if (!thinkingOverlayEl) return;
        thinkingOverlayEl.classList.remove('opacity-100');
        thinkingOverlayEl.classList.add('opacity-0');
        liveThinkingText = '';
        const pre = thinkingOverlayEl.querySelector('pre');
        if (pre) pre.textContent = '';
    }, 5000);
}

function armDeleteButton(btn, label) {
    let armed = false;
    let timer = null;
    const reset = () => {
        armed = false;
        btn.textContent = label;
        btn.classList.remove('border-red-300', 'text-red-700', 'bg-red-50');
        if (timer) { clearTimeout(timer); timer = null; }
    };
    btn.addEventListener('mouseleave', () => { if (armed) reset(); });
    return async function () {
        if (!armed) {
            armed = true;
            btn.textContent = 'sure?';
            btn.classList.add('border-red-300', 'text-red-700', 'bg-red-50');
            timer = setTimeout(reset, 2000);
            return false;
        }
        reset();
        return true;
    };
}

function wireDeleteControls(root) {
    root.querySelectorAll('[data-delete-idx]').forEach((btn) => {
        if (btn.__wired) return;
        btn.__wired = true;
        const label = btn.textContent || 'delete';
        const confirmDelete = armDeleteButton(btn, label);
        btn.addEventListener('click', async () => {
            if (!(await confirmDelete())) return;
            const fd = new FormData();
            fd.set('idx', String(btn.dataset.deleteIdx || ''));
            fd.set('mode', String(btn.dataset.deleteMode || 'one'));
            const res = await fetch('/agent/' + encodeURIComponent(agentId) + '/messages/delete', { method: 'POST', body: fd });
            if (res.ok || res.status === 303) location.reload();
            else {
                let msg = 'delete failed';
                try { msg = (await res.json()).error || msg; } catch {}
                alert(msg);
            }
        });
    });
}

function addHtml(html, usage) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html || "";
    while (wrap.firstChild) messagesEl.appendChild(wrap.firstChild);
    wireDeleteControls(messagesEl);
    messagesEl.lastElementChild?.scrollIntoView({ block: "end" });
    updateUsage(usage);
}

function addError(t) { bubble("bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words", t); }

function renderEvents(list) {
    for (const ev of list) {
        if (ev.type === 'thinking' && ev.text) continue;
        const html = ev.eventHtml || ev.html;
        if (html) addHtml(html, ev.usage);
        else if (ev.type === "error") addError(ev.error);
        if (ev.type === 'assistant' || ev.type === 'error' || ev.type === 'tool_call') hideThinkingSoon();
    }
}

document.addEventListener('hyper-events', (e) => {
    const ev = e.detail;
    if (!ev || ev.agentId !== agentId) return;
    if (ev.type === 'agent.thinking.delta') {
        liveThinkingText = ev.text || (liveThinkingText + (ev.delta || ''));
        showThinking(liveThinkingText);
    }
    if (ev.type === 'agent.thinking.done') hideThinkingSoon();
});

wireDeleteControls(messagesEl);
if (inheritedCount > 0) addPending('inherited context: ' + inheritedCount + ' msgs');
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
        if (!data.isStreaming) {
            hideThinkingSoon();
            return;
        }
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
        } else {
            hideThinkingSoon();
        }
    } catch (err) {
        pending.remove();
        addError(err.message);
        hideThinkingSoon();
    } finally {
        if (send) send.disabled = false;
        input.focus();
    }
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});
input.focus();
