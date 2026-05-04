export default async function (ctx: Context) {
    const defaultModel = ctx.fns.settings?.modelDefault?.(ctx) ?? ctx.env.MODEL ?? "";
    const groups = await ctx.fns.llm.listModels(ctx);
    const base = await ctx.fns.agent.getBasePromptParts(ctx);
    const coreTokens = Math.ceil((base.core?.length || 0) / 4);
    const wireTokens = Math.ceil((base.wire?.length || 0) / 4);
    const presets = await ctx.fns.agent.listPromptPresets(ctx);
    const presetsWithTokens = Object.entries(presets).map(([id, preset]: [string, any]) => ({
      id,
      ...preset,
      tokens: Math.ceil((preset.text?.length || 0) / 4)
    }));

    const optgroups = Object.entries(groups).map(([provider, ids]) => {
        const opts = (ids as string[]).map(id =>
            `<option value="${esc(id)}" ${id === defaultModel ? "selected" : ""}>${esc(id)}</option>`
        ).join("");
        return `<optgroup label="${esc(provider)}">${opts}</optgroup>`;
    }).join("");

    const presetItems = presetsWithTokens.map(preset => `
      <details class="rounded-md border border-gray-200 bg-white">
        <summary class="cursor-pointer select-none px-3 py-3">
          <label class="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" name="promptPreset" value="${esc(preset.id)}" class="mt-0.5">
            <span class="min-w-0 flex-1">
              <span class="font-medium">${esc(preset.label)} <span class="text-gray-400 font-normal">${preset.tokens}t</span></span>
              <span class="block text-xs text-gray-500 mt-0.5">${esc(oneLine(preset.text))}</span>
            </span>
          </label>
        </summary>
        <div class="border-t border-gray-200 px-3 py-3">
          <div class="mb-2 text-xs text-gray-500">preview</div>
          <pre class="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-[11px] leading-snug text-gray-700">${esc(preset.text)}</pre>
        </div>
      </details>
    `).join("");

    const main = `<div class="flex-1 overflow-y-auto">
<form method="POST" action="/agent/new" class="max-w-2xl mx-auto px-6 py-8 space-y-5">
  <h1 class="text-xl font-semibold text-gray-800">New agent</h1>

  <label class="block">
    <span class="block text-xs font-semibold text-gray-600 mb-1">model</span>
    <select name="model" class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono bg-white">
      ${optgroups}
    </select>
    <span class="block mt-1 text-xs text-gray-500">LM Studio models are fetched live; remote models use the provider-prefixed id (<code>kimi:...</code>, <code>openai:...</code>) and need the matching API key env var set.</span>
  </label>

  <section class="space-y-3">
    <div>
      <h2 class="text-sm font-semibold text-gray-700">Base system prompt</h2>
      <p class="mt-1 text-xs text-gray-500">The default agent prompt is always included. Presets and custom instructions are added on top.</p>
    </div>

    <details class="rounded-md border border-gray-200 bg-white">
      <summary class="cursor-pointer select-none px-3 py-3 text-sm font-medium text-gray-700">Runtime and behavior <span class="text-gray-400 font-normal ml-2">${coreTokens}t</span></summary>
      <div class="border-t border-gray-200 px-3 py-3">
        <pre class="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-[11px] leading-snug text-gray-700">${esc(base.core)}</pre>
      </div>
    </details>

    <details class="rounded-md border border-gray-200 bg-white">
      <summary class="cursor-pointer select-none px-3 py-3 text-sm font-medium text-gray-700">Markers protocol <span class="text-gray-400 font-normal ml-2">${wireTokens}t</span></summary>
      <div class="border-t border-gray-200 px-3 py-3">
        <pre class="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-[11px] leading-snug text-gray-700">${esc(base.wire)}</pre>
      </div>
    </details>
  </section>

  <section class="space-y-3">
    <div>
      <h2 class="text-sm font-semibold text-gray-700">prompt presets</h2>
      <p class="mt-1 text-xs text-gray-500">Choose reusable instruction blocks. You can also rewrite or extend them in the custom textarea below.</p>
    </div>
    <div class="space-y-3">
      ${presetItems}
    </div>
  </section>

  <label class="block">
    <span class="block text-xs font-semibold text-gray-600 mb-1">system prompt <span class="font-normal text-gray-400">(optional custom instructions)</span></span>
    <textarea name="systemPrompt" rows="12" placeholder="" class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y"></textarea>
  </label>

  <div class="flex gap-3">
    <button type="submit" class="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700">create agent</button>
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