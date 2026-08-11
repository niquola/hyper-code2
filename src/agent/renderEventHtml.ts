function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

// Tags whose imbalance would shred the page layout when injected into
// the chat stream. We don't try to balance every tag — just the ones
// that markdown.render or assistant prose tends to produce. If even one
// of these is mis-counted we fall back to a plain <pre> wrapper so a
// single bad bubble can't break everything below it. Catches the
// "heredoc / shell `>` / unclosed code block" class of bug.
const BALANCE_TAGS = ['div', 'p', 'span', 'pre', 'code', 'details', 'ul', 'ol', 'li', 'table', 'tbody', 'thead', 'tr', 'td', 'th'];
function isHtmlBalanced(html: string): boolean {
    for (const tag of BALANCE_TAGS) {
        const opens = html.match(new RegExp(`<${tag}(?:\\s|>|/)`, 'g')) ?? [];
        const closes = html.match(new RegExp(`</${tag}\\s*>`, 'g')) ?? [];
        // Treat self-closed (<tag/>) as both open and close — they cancel out.
        const selfClose = html.match(new RegExp(`<${tag}(?:\\s[^>]*)?/>`, 'g')) ?? [];
        const open = opens.length - selfClose.length;
        if (open !== closes.length) return false;
    }
    return true;
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

export default async function (_ctx: Context, _session: Session | null, opts: { event: any; agentId?: string }): Promise<string> {

function messageTime(ts: any): string {
    const value = Number(ts);
    if (!Number.isFinite(value)) return '';
    return new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function timeHtml(ts: any, align: 'left' | 'right'): string {
    const time = messageTime(ts);
    if (!time) return '';
    return '<div class="mt-1 text-[10px] leading-none '
        + (align === 'right' ? 'text-right text-gray-400' : 'text-left text-gray-400')
        + '">' + esc(time) + '</div>';
}
    const ev = opts.event;
    const agentId = String(opts.agentId ?? ev?.agentId ?? '');
    if (!ev || typeof ev !== "object") return "";

    if (ev.excludedFromLlm) {
        // Collapsed out of the LLM's view after a successful correction — the
        // audit stays visible, dimmed, with an out-of-context chip. Recurse
        // through the registry for the normal rendering of the same event.
        const inner: string = await (_ctx as any).fns.agent.renderEventHtml({ event: { ...ev, excludedFromLlm: false }, agentId });
        return '<div class="relative opacity-50"><span class="absolute -top-2 right-2 z-10 text-[10px] px-1.5 py-0.5 rounded-full border border-gray-300 bg-gray-100 text-gray-500">вне контекста</span>' + inner + '</div>';
    }

    if (ev.type === "user") {
        const idx = ev.messageIdx ?? ev.idx ?? 0;
        return '<div class="group relative flex justify-end">'
            + deleteControls(idx, agentId, true, true)
            + '<div class="ml-auto max-w-[80%] rounded-2xl bg-gray-900 px-4 py-3 text-white whitespace-pre-wrap break-words shadow-sm">'
            + esc(ev.text)
            + timeHtml(ev.ts, 'right')
            + '</div></div>';
    }

    if (ev.type === "assistant") {
        const idx = ev.messageIdx ?? ev.idx ?? 0;
        const usage = '';
        // Defensive: if the pre-rendered html is unbalanced (markdown.render
        // sometimes chokes on heredoc / shell `>` / mixed-code prose) fall
        // back to a plain escaped <pre>. One bad bubble must not break the
        // whole page layout below it.
        const rawHtml = ev.html || ('<p>' + esc(ev.text || '') + '</p>');
        const safeHtml = isHtmlBalanced(rawHtml)
            ? rawHtml
            : '<pre class="text-xs whitespace-pre-wrap break-words">' + esc(ev.text || '') + '</pre>';
        return '<div class="group relative flex justify-start">'
            + deleteControls(idx, agentId, true, true)
            + '<div class="assistant max-w-[90%] rounded-2xl bg-gray-50 px-4 py-3 shadow-sm border border-gray-200">'
            + '<div class="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2">'
            + safeHtml
            + '</div>'
            + timeHtml(ev.ts, 'left') 
            + usage
            + '</div></div>';
    }

    if (ev.type === "thinking") {
        return '<details class="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5"><summary class="cursor-pointer select-none">💭 thinking (' + (ev.text?.length ?? 0) + ' chars)</summary><pre class="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-snug text-gray-600">' + esc(ev.text || '') + '</pre></details>';
    }

    if (ev.type === "tool_call") {
        const meta = (_ctx as any).fns.agent.toolMeta({ name: ev.name, args: ev.args });
        const result = String(ev.result ?? '');
        const lines = result ? result.split('\n').length : 0;
        // Size in the units a reader thinks in — lines for output, KB only when
        // it is genuinely big — instead of a raw character count.
        const size = !result ? ''
            : result.length > 2048 ? (result.length / 1024).toFixed(1) + ' KB'
            : lines > 1 ? lines + ' lines'
            : result.length + ' chars';
        const status = ev.isError
            ? '<span class="inline-flex items-center gap-1 text-red-600"><i class="ph ph-warning-circle"></i>error</span>'
            : '<span class="text-emerald-600"><i class="ph ph-check"></i></span>';

        // Three ages, so a card is loud exactly while it is news:
        //   < 5s   open — you are watching it happen
        //   < 20s  one line — still recent, still worth a glance
        //   older  tucked into an icon in a tray with its neighbours
        // Decided HERE as well as in the browser, so reloading a long
        // transcript does not flash a hundred expanded cards before the timers
        // run. A write opens too — the body it just committed is worth seeing —
        // but it still ages: only a FAILURE is pinned, because that is the one
        // thing nobody should have to go digging for.
        const age = Date.now() - Number(ev.ts ?? Date.now());
        const tucked = !ev.isError && age >= 20_000;
        // Order matters: a tucked card is an icon, and an icon cannot also be
        // an open disclosure. A write stays open for the whole recent window
        // (its body is the point) but tucks away like everything else.
        const openAttr = (ev.isError || (!tucked && (ev.name === 'write' || age < 5_000))) ? ' open' : '';
        return '<details' + openAttr + ' class="group/tool tool rounded-xl border text-xs leading-snug overflow-hidden '
            + (ev.isError ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white') + (tucked ? ' tool-tucked' : '') + '"'
            + ' data-tool="' + esc(ev.name || 'tool') + '" data-ts="' + esc(String(ev.ts ?? '')) + '"'
            + (ev.isError ? ' data-pinned="1"' : '')
            + ' title="' + esc(meta.label + ' ' + meta.subject) + '">'
            + '<summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-2 hover:bg-gray-50">'
            + '<i class="ph ' + esc(meta.icon) + ' text-sm text-gray-400 shrink-0"></i>'
            + '<span class="tool-label font-mono font-medium text-gray-700 shrink-0">' + esc(meta.label) + '</span>'
            + '<span class="tool-subject min-w-0 flex-1 truncate font-mono text-gray-500">' + esc(meta.subject) + '</span>'
            + (size ? '<span class="tool-size shrink-0 text-[10px] text-gray-400">' + esc(size) + '</span>' : '')
            + '<span class="tool-status shrink-0">' + status + '</span>'
            + '<i class="tool-caret ph ph-caret-down text-[10px] text-gray-300 transition-transform group-open/tool:rotate-180"></i>'
            + '</summary>'
            + '<div class="border-t border-gray-100 bg-gray-50/60 px-3 py-2 tool-code">' + (ev.argsHtml || '') + '</div>'
            + (result
                ? '<div class="border-t border-gray-100 px-3 py-2 text-gray-700 tool-result">' + (ev.resultHtml || '') + '</div>'
                : '')
            + '</details>';
    }

    if (ev.type === "attempt") {
        // A protocol-invalid candidate that was repaired before commit — never
        // part of the LLM transcript; kept for the audit trail.
        return '<div class="relative opacity-50"><details class="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden text-xs">'
            + '<summary class="cursor-pointer select-none px-4 py-2 text-amber-800">invalid attempt · repaired before commit <span class="text-amber-600">(' + esc(String(ev.error ?? '').slice(0, 80)) + ')</span></summary>'
            + '<pre class="px-4 py-3 whitespace-pre-wrap break-words text-gray-600 bg-white">' + esc(ev.text) + '</pre></details></div>';
    }

    if (ev.type === "error") {
        return '<div class="bg-gray-100 text-red-700 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-words">' + esc(ev.error) + '</div>';
    }

    if (ev.type === "job") {
        return '';
    }

    return '';
}
