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
    const btn = (mode: 'one' | 'from', title: string, confirm: string, icon: string) =>
        '<button type="button"'
        + ' hx-post="' + url + '"'
        // The page is reloaded on success, so the response is not UI: say so,
        // or an inherited hx-target/hx-swap paints it over whatever contains us.
        + ' hx-swap="none"'
        + ' hx-vals=\'{"idx":"' + String(idx) + '","mode":"' + mode + '"}\''
        + ' hx-confirm="' + confirm + '"'
        + ' hx-on::after-request="if (event.detail.successful) location.reload();"'
        + ' title="' + title + '" aria-label="' + title + '"'
        + ' class="flex size-7 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-400 shadow-sm backdrop-blur transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200">'
        + '<i class="ph ' + icon + ' text-sm" aria-hidden="true"></i><span class="sr-only">' + title + '</span></button>';
    return '<div class="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">'
        + (allowOne ? btn('one', 'Delete message', 'delete this message?', 'ph-trash') : '')
        + (allowFrom ? btn('from', 'Delete from here', 'delete this and everything after?', 'ph-arrow-line-down') : '')
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

function timeHtml(ts: any, tone: 'dark' | 'light', suffix = ''): string {
    const time = messageTime(ts);
    if (!time) return '';
    // Telegram-style: an inline stamp consumes only the tail of the final line.
    // It stays beside a one-liner and naturally lands at the lower-right when
    // text wraps.
    return '<span class="inline-block ml-2 whitespace-nowrap text-[10px] leading-none '
        + (tone === 'dark' ? 'text-gray-400' : 'text-gray-400')
        + '">' + esc(time) + suffix + '</span>';
}

function appendTime(html: string, ts: any, tone: 'dark' | 'light', suffix = ''): string {
    const stamp = timeHtml(ts, tone, suffix);
    if (!stamp) return html;
    // Markdown's common one-line shape is <p>…</p>. Keeping the float inside
    // that final paragraph lets it share the line instead of creating a row.
    if (/<\/p>\s*$/.test(html)) return html.replace(/<\/p>\s*$/, stamp + '</p>');
    return html + stamp;
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
            + '<div class="ml-auto max-w-[80%] rounded-xl bg-gray-600 px-4 py-3 text-white whitespace-pre-wrap break-words shadow-sm">'
            + appendTime(esc(ev.text), ev.ts, 'dark')
            + '</div></div>';
    }

    if (ev.type === "assistant") {
        const idx = ev.messageIdx ?? ev.idx ?? 0;
        const usage = '';
        // Defensive: if the pre-rendered html is unbalanced (markdown.render
        const indicators = ev.instructionIndicators ?? {};
        const statusDot = indicators.statusLine
            ? '<span title="Status line: ' + esc(indicators.statusLine) + '" aria-label="status line applied" class="ml-1.5 inline-block size-1.5 rounded-full bg-gray-400 align-middle"></span>'
            : '';
        const nudgeDot = indicators.reflectionNudge
            ? '<span title="Reflection nudge: ' + esc(indicators.reflectionNudge) + '" aria-label="reflection nudge applied" class="ml-1 inline-flex align-middle text-violet-500"><i class="ph ph-brain text-[11px]"></i></span>'
            : '';
        const instructionMarks = statusDot + nudgeDot;
        // sometimes chokes on heredoc / shell `>` / mixed-code prose) fall
        // back to a plain escaped <pre>. One bad bubble must not break the
        // whole page layout below it.
        const rawHtml = ev.html || ('<p>' + esc(ev.text || '') + '</p>');
        const safeHtml = isHtmlBalanced(rawHtml)
            ? rawHtml
            : '<pre class="text-xs whitespace-pre-wrap break-words">' + esc(ev.text || '') + '</pre>';
        return '<div class="group relative flex justify-start">'
            + deleteControls(idx, agentId, true, true)
            + '<div class="assistant max-w-[90%] rounded-2xl bg-white px-4 py-3 shadow-sm border border-gray-200">'
            + '<div class="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2">'
            + appendTime(safeHtml, ev.ts, 'light', instructionMarks)
            + '</div>'
            + usage
            + '</div></div>';
    }

    if (ev.type === "thinking") {
        return '<details class="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5"><summary class="cursor-pointer select-none">💭 thinking (' + (ev.text?.length ?? 0) + ' chars)</summary><pre class="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-snug text-gray-600">' + esc(ev.text || '') + '</pre></details>';
    }

    if (ev.type === "tool_call") {
        const meta = (_ctx as any).fns.agent.toolMeta({ name: ev.name, args: ev.args });
        // File-changing tools get a stronger outline; errors take precedence.
        const destructive = new Set(['write', 'edit', 'remove', 'rename']).has(String(ev.name ?? ''));
        const cardStyle = ev.isError
            ? 'border-red-200 bg-red-50/40 text-red-500'
            : destructive ? 'border-gray-500 bg-white text-gray-500' : 'border-gray-200 bg-white text-gray-400';
        const bodyUrl = agentId && ev.idx != null
            ? `/agent/${encodeURIComponent(agentId)}/tool/${Number(ev.idx)}`
            : '';
        const title = String(meta.label + ' ' + meta.subject).trim();

        // The transcript carries only a compact trigger. HTMX fetches the
        // expensive highlighted body directly into the shared native dialog.
        return '<button type="button" class="tool tool-tucked shrink-0 rounded-full border ' + cardStyle + '"'
            + ' data-tool="' + esc(ev.name || 'tool') + '"'
            + ' data-title="' + esc(title) + '"'
            + (bodyUrl ? ' hx-get="' + esc(bodyUrl) + '" hx-target="#tool-dialog-body" hx-swap="innerHTML"' : '')
            + ' hx-on::before-request="document.getElementById(\'tool-dialog-title\').textContent=this.dataset.title; document.getElementById(\'tool-dialog-body\').innerHTML=\'<div class=&quot;text-sm text-gray-400&quot;>loading…</div>\'; document.getElementById(\'tool-dialog\').showModal()"'
            + (ev.isError ? ' data-error="1"' : '')
            + ' title="' + esc(title) + '" aria-label="' + esc(title) + '">'
            + '<i class="ph ' + esc(meta.icon) + '" aria-hidden="true"></i>'
            + '</button>';
    }

    if (ev.type === "plan_activation") {
        return `<div class="mx-auto max-w-[90%] rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800"><div class="flex items-center gap-1.5 font-medium"><i class="ph ph-list-checks"></i> Plan task injected</div><div class="mt-1 font-medium leading-5">${esc(ev.title ?? ev.taskId ?? "Task")}</div>${ev.instructions ? `<div class="mt-1 whitespace-pre-wrap leading-5 opacity-80">${esc(ev.instructions)}</div>` : ""}</div>`;
    }


    if (ev.type === "goal_activation") {
        return `<div class="mx-auto max-w-[90%] rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800"><div class="flex items-center gap-1.5 font-medium"><i class="ph ph-target"></i> Goal enabled · ${Number(ev.iterations ?? 3)} iterations</div><div class="mt-1 leading-5 opacity-80">${esc(ev.text ?? "")}</div></div>`;
    }


    if (ev.type === "goal_check") {
        const status = String(ev.status ?? "unclear");
        const achieved = status === "achieved";
        const limited = status === "limit_reached";
        const color = achieved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : limited ? "border-orange-200 bg-orange-50 text-orange-800" : status === "continue" ? "border-indigo-200 bg-indigo-50 text-indigo-800" : "border-amber-200 bg-amber-50 text-amber-800";
        const icon = achieved ? "ph-check-circle" : limited ? "ph-stop-circle" : status === "continue" ? "ph-target" : "ph-warning-circle";
        const count = ev.maxIterations ? ` · ${Number(ev.iteration ?? 0)}/${Number(ev.maxIterations)}` : "";
        return `<div class="mx-auto max-w-[90%] rounded-lg border px-3 py-2 text-xs ${color}"><div class="flex items-center gap-1.5 font-medium"><i class="ph ${icon}"></i> Goal check: ${esc(status)}${count}</div><div class="mt-1 leading-5 opacity-80">${esc(ev.reason ?? "")}</div>${ev.nextStep ? `<div class="mt-1 leading-5"><span class="font-medium">Next:</span> ${esc(ev.nextStep)}</div>` : ""}</div>`;
    }


    if (ev.type === "attempt") {
        // A protocol-invalid candidate that was repaired before commit — never
        // part of the LLM transcript; kept for the audit trail.
        return '<div class="relative opacity-50"><details class="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden text-xs">'
            + '<summary class="cursor-pointer select-none px-4 py-2 text-amber-800">invalid attempt · repaired before commit <span class="text-amber-600">(' + esc(String(ev.error ?? '').slice(0, 80)) + ')</span></summary>'
            + '<pre class="px-4 py-3 whitespace-pre-wrap break-words text-gray-600 bg-white">' + esc(ev.text) + '</pre></details></div>';
    }

    if (ev.type === "error") {
        // Errors surface as a toast (session.appendErrorEvent notifies) and in
        // the status bar; the row stays in the events table for the audit.
        // Keeping a red slab in the transcript on top of that was three copies
        // of the same bad news, and the only one that could not be dismissed.
        return '';
    }

    if (ev.type === "job") {
        return '';
    }

    return '';
}
