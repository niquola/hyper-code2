export default async function (ctx: Context) {
    const defaultModel = ctx.env.MODEL ?? "";
    const main = `<div class="flex-1 overflow-y-auto">
<form method="POST" action="/agent/new" class="max-w-2xl mx-auto px-6 py-8 space-y-5">
  <h1 class="text-xl font-semibold text-gray-800">New agent</h1>

  <label class="block">
    <span class="block text-xs font-semibold text-gray-600 mb-1">model</span>
    <input name="model" value="${esc(defaultModel)}" placeholder="e.g. minimax/minimax-m2.7" class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono" />
  </label>

  <label class="block">
    <span class="block text-xs font-semibold text-gray-600 mb-1">system prompt <span class="font-normal text-gray-400">(leave empty to use the default)</span></span>
    <textarea name="systemPrompt" rows="12" placeholder="" class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y"></textarea>
  </label>

  <div class="flex gap-3">
    <button type="submit" class="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700">create agent</button>
    <a href="/" class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">cancel</a>
  </div>
</form>
</div>`;
    const html = ctx.fns.ui.layout(ctx, { title: "new agent", main });
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
