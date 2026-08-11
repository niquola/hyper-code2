// GET /agent/new — the new-agent form. ONE form body, two shells: the rail's
// "+" asks for ?popup=1 and gets it as an overlay (scrollable, everything
// included — presets and the custom prompt too); without the flag it is the
// same form as a plain page. The model preselected is the last one anybody
// picked (kv last-model) — choosing once is choosing a default.
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    const lastModel = ((await ctx.fns.procs.db.select({
        sql: "SELECT value FROM kv WHERE key = 'last-model'",
    }).catch(() => [])) as any[])[0]?.value;
    const defaultModel = lastModel ?? (await ctx.fns.settings?.modelDefault?.({})) ?? ctx.env.MODEL ?? "";

    const groups = await ctx.fns.llm.listModels({});
    const base = await ctx.fns.agent.getBasePromptParts({});
    const coreTokens = Math.ceil((base.core?.length || 0) / 4);
    const presets = await ctx.fns.agent.listPromptPresets({});
    const presetsWithTokens = Object.entries(presets).map(([id, preset]: [string, any]) => ({
        id, ...preset, tokens: Math.ceil((preset.text?.length || 0) / 4),
    }));

    const optgroups = Object.entries(groups).map(([provider, ids]) => {
        const opts2 = (ids as string[]).map(id =>
            `<option value="${esc(id)}" ${id === defaultModel ? "selected" : ""}>${esc(id)}</option>`).join("");
        return `<optgroup label="${esc(provider)}">${opts2}</optgroup>`;
    }).join("");

    const presetItems = presetsWithTokens.map(preset => `
      <details class="rounded-md border border-gray-200 bg-white">
        <summary class="cursor-pointer select-none px-3 py-2">
          <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" name="promptPreset" value="${esc(preset.id)}" class="mt-0.5">
            <span class="min-w-0 flex-1">
              <span class="font-medium">${esc(preset.label)} <span class="text-gray-400 font-normal">${preset.tokens}t</span></span>
              <span class="block text-xs text-gray-500 mt-0.5">${esc(oneLine(preset.text))}</span>
            </span>
          </label>
        </summary>
        <div class="border-t border-gray-200 px-3 py-2">
          <pre class="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-[11px] leading-snug text-gray-700">${esc(preset.text)}</pre>
        </div>
      </details>`).join("");

    // The one form, shared by both shells. The wire/markers section is gone
    // with the markers protocol itself; core is the only base part left.
    const formBody = `
      <input name="title" maxlength="120" placeholder="title (optional)" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
      <div>
        <select name="model" class="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm">${optgroups}</select>
        <span class="mt-1 block text-[11px] text-gray-400">last picked is preselected · remote ids need their API key env var</span>
      </div>
      <div>
        <input name="workspaceDir" list="workspace-dirs" value="${esc(process.cwd())}" placeholder="working directory"
               hx-get="/agent/dirs" hx-trigger="keyup changed delay:250ms" hx-target="#workspace-dirs" hx-swap="innerHTML"
               hx-vals="js:{q: event.target.value}"
               class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm" data-field="workspaceDir">
        <datalist id="workspace-dirs"></datalist>
      </div>
      <details class="rounded-md border border-gray-200 bg-white">
        <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700">Base system prompt <span class="text-gray-400 font-normal ml-1">${coreTokens}t · always included</span></summary>
        <div class="border-t border-gray-200 px-3 py-2">
          <pre class="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-[11px] leading-snug text-gray-700">${esc(base.core)}</pre>
        </div>
      </details>
      ${presetItems ? `<div class="space-y-2"><span class="block text-xs font-semibold text-gray-600">prompt presets</span>${presetItems}</div>` : ""}
      <textarea name="systemPrompt" rows="4" placeholder="custom instructions (optional)" class="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm resize-y"></textarea>`;

    if (new URL(_opts.req.url).searchParams.get("popup")) {
        const overlay = `<div id="modal-overlay" class="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16" onclick="if (event.target === this) this.remove()">
  <div class="w-[34rem] max-h-[85vh] overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-xl p-4">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-800">New agent</h2>
      <button onclick="document.getElementById('modal-overlay').remove()" class="px-1 text-gray-400 hover:text-gray-700">✕</button>
    </div>
    <form method="POST" action="/agent/new" hx-boost="false" class="space-y-3" data-form="new-agent">
      ${formBody}
      <div class="flex items-center gap-3 pt-1">
        <button type="submit" class="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700" data-action="create">create</button>
        <button type="button" onclick="document.getElementById('modal-overlay').remove()" class="ml-auto text-xs text-gray-500 hover:text-gray-800">cancel</button>
      </div>
    </form>
  </div>
</div>`;
        return new Response(overlay, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    const main = `<div class="flex-1 overflow-y-auto">
<form method="POST" action="/agent/new" hx-boost="false" class="max-w-2xl mx-auto px-6 py-8 space-y-4" data-form="new-agent">
  <h1 class="text-xl font-semibold text-gray-800">New agent</h1>
  ${formBody}
  <div class="flex gap-3">
    <button type="submit" class="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700" data-action="create">create agent</button>
    <a href="/" class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">cancel</a>
  </div>
</form>
</div>`;
    return { title: "new agent", main };
}

function oneLine(s: string): string {
    return String(s ?? "").split("\n").find(Boolean) ?? "";
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
