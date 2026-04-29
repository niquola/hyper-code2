const { agentId, offset: initialOffset, isStreaming: initialStreaming, inheritedCount = 0 } = window.__init;
let offset = initialOffset;

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const send = document.getElementById("send");
const usageEl = document.getElementById("context-usage");

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
        // assistant stores `html` (inner markdown) AND `eventHtml` (full SSR bubble);
        // other event types store the full bubble in `html`. Prefer the wrapped one.
        const html = ev.eventHtml || ev.html;
        if (html) addHtml(html, ev.usage);
        else if (ev.type === "error") addError(ev.error);
    }
}

// Initial events are SSR'd straight into #messages by $route_$id_GET.ts —
// only wire delete controls + start polling here. New events come in via poll.
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
