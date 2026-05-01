function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

function fmtTok(n: any): string {
    if (n == null) return "—";
    if (Number(n) < 1000) return String(n);
    const v = Math.round(Number(n) / 100) / 10;
    return String(v).replace(/\.0$/, "") + "k";
}

function deleteControls(idx: any, agentId: string, allowOne = true, allowFrom = true): string {
    if (!agentId) return '';
    const url = '/agent/' + encodeURIComponent(agentId) + '/messages/delete';
    const btn = (mode: 'one' | 'from', label: string, confirm: string) =>
        '<button type="button"'
        + ' hx-post="' + url + '"'
        + ' hx-vals=\'{"idx":"' + String(idx) + '","mode":"' + mode + '"}\''
        + ' hx-confirm="' + confirm + '"'
        + ' hx-on::after-request="if (event.detail.successful) location.reload();"'
        + ' class="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50">' + label + '</button>';
    return '<div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">'
        + (allowOne ? btn('one', 'delete', 'delete this message?') : '')
        + (allowFrom ? btn('from', 'from here', 'delete this and everything after?') : '')
        + '</div>';
}

export default async function (_ctx: Context, ev: any, opts: { agentId?: string } = {}): Promise<string> {
    const agentId = String(opts.agentId ?? ev.agentId ?? '');
    if (!ev || typeof ev !== "object") return "";

    if (ev.type === "user") {
        const idx = ev.messageIdx ?? ev.idx ?? 0;
        return '<div class="group relative flex justify-end">'
            + deleteControls(idx, agentId, true, true)
            + '<div class="ml-auto max-w-[80%] rounded-2xl bg-gray-900 px-4 py-3 text-white whitespace-pre-wrap break-words shadow-sm">'
            + esc(ev.text)
            + '</div></div>';
    }

    if (ev.type === "assistant") {
        const idx = ev.messageIdx ?? ev.idx ?? 0;
        const usage = ''; 
        return '<div class="group relative flex justify-start">'
            + deleteControls(idx, agentId, true, true)
            + '<div class="assistant max-w-[90%] rounded-2xl bg-gray-50 px-4 py-3 shadow-sm border border-gray-200">'
            + '<div class="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2">'
            + (ev.html || '<p>' + esc(ev.text || '') + '</p>')
            + '</div>'
            + usage
            + '</div></div>';
    }

    if (ev.type === "thinking") {
        return '<details class="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5"><summary class="cursor-pointer select-none">💭 thinking (' + (ev.text?.length ?? 0) + ' chars)</summary><pre class="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-snug text-gray-600">' + esc(ev.text || '') + '</pre></details>';
    }

    if (ev.type === "tool_call") {
        const argsLen = String(ev.args?.code ?? JSON.stringify(ev.args ?? {})).length;
        const resultLen = String(ev.result ?? '').length;
        const status = ev.isError ? '<span class="text-red-600">error</span>' : '<span class="text-green-700">ok</span>';
        return '<details class="tool border border-gray-200 rounded-xl overflow-hidden text-xs leading-snug bg-white shadow-sm ' + (ev.isError ? 'ring-1 ring-red-200' : '') + '"><summary class="cursor-pointer select-none flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200"><span class="font-semibold">tool: ' + esc(ev.name || '') + '</span><span class="text-gray-500 font-mono">args ' + argsLen + 'c · result ' + resultLen + 'c · ' + status + '</span></summary><div class="bg-white px-4 py-3 tool-code">' + (ev.argsHtml || '') + '</div><div class="bg-gray-50 border-t border-gray-200 px-4 py-3 text-gray-700 tool-result">' + (ev.resultHtml || '') + '</div></details>';
    }

    if (ev.type === "error") {
        return '<div class="bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words">' + esc(ev.error) + '</div>';
    }

    if (ev.type === "job") {
        return '';
    }

    return '';
}
