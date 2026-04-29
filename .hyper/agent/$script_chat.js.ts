export default async function () {
    return new Response(String.raw`(() => {
  const init = window.__init || {};
  const agentId = init.agentId;
  const messagesEl = document.getElementById("messages");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const usageEl = document.getElementById("context-usage");
  let offset = init.offset || 0;
  let busy = !!init.isStreaming;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function setBusy(v) {
    busy = !!v;
    if (input) input.disabled = busy;
  }

  function updateUsage(usage) {
    if (!usageEl) return;
    if (!usage) {
      usageEl.textContent = "ctx: —";
      return;
    }
    const inTok = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens;
    const total = usage.total_tokens ?? usage.totalTokens;
    if (inTok != null && total != null) usageEl.textContent = "ctx: " + inTok + " tok · total: " + total;
    else if (inTok != null) usageEl.textContent = "ctx: " + inTok + " tok";
    else if (total != null) usageEl.textContent = "ctx total: " + total;
    else usageEl.textContent = "ctx: —";
  }

  function renderEvent(ev) {
    const div = document.createElement("div");
    if (ev.type === "user") {
      div.className = "flex justify-end";
      div.innerHTML = '<div class="max-w-[80%] px-3 py-2 rounded bg-blue-600 text-white whitespace-pre-wrap">' + esc(ev.text || "") + '</div>';
    } else if (ev.type === "assistant") {
      div.className = "flex justify-start";
      div.innerHTML = '<div class="max-w-[90%] prose prose-sm">' + (ev.html || esc(ev.text || "")) + '</div>';
      updateUsage(ev.usage);
    } else if (ev.type === "thinking") {
      div.className = "text-xs text-gray-400 italic";
      div.textContent = ev.text || "";
    } else if (ev.type === "tool_call") {
      div.className = "border rounded bg-gray-50 p-2 text-xs font-mono";
      div.innerHTML = '<div class="font-semibold mb-1">tool: ' + esc(ev.name || "") + (ev.isError ? " (error)" : "") + '</div>' + (ev.argsHtml || "") + (ev.resultHtml || "");
    } else if (ev.type === "error") {
      div.className = "text-red-600 text-sm";
      div.textContent = ev.error || "error";
    } else {
      div.className = "text-sm";
      div.textContent = JSON.stringify(ev);
    }
    if (messagesEl) messagesEl.appendChild(div);
    if (messagesEl && messagesEl.lastElementChild) messagesEl.lastElementChild.scrollIntoView({ block: "end" });
  }

  (init.initialEvents || []).forEach(renderEvent);

  async function poll() {
    try {
      const res = await fetch("/agent/" + encodeURIComponent(agentId) + "/events?offset=" + offset, { cache: "no-store" });
      const data = await res.json();
      (data.events || []).forEach(renderEvent);
      offset = data.nextOffset || offset;
      setBusy(!!data.isStreaming);
      updateUsage(data.usage);
    } catch {}
    setTimeout(poll, busy ? 350 : 1200);
  }
  poll();

  if (form) form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = ((input && input.value) || "").trim();
    if (!text || busy) return;
    if (input) input.value = "";
    setBusy(true);
    try {
      const res = await fetch("/agent/" + encodeURIComponent(agentId), { method: "POST", body: text });
      const data = await res.json();
      offset = data.nextOffset || offset;
    } catch {
      setBusy(false);
    }
  });

  if (input) input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && form) form.requestSubmit();
  });
})();`, { headers: { "content-type": "application/javascript; charset=utf-8" } });
}
