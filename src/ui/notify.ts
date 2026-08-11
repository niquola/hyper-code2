// Push a toast to every open tab.
//
// `message` is the one line a reader scans; `body` is the detail they need when
// that line is not enough — a provider's 400 explanation, a stack, the tail of
// a failed command. `bodyHtml` is the same detail already syntax-highlighted,
// which is what a tool call sends: a shell command reads as a command and a
// file reads as its language, in the corner as much as in the transcript.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { message: string; body?: string; bodyHtml?: string; level?: 'info' | 'warn' | 'error'; html?: string; agentId?: string },
) {
    const event = {
        type: 'ui.notify',
        level: opts.level ?? 'info',
        message: opts.message,
        body: opts.body ?? null,
        bodyHtml: opts.bodyHtml ?? null,
        html: opts.html ?? null,
        // Which agent's work this is about. A tab showing agent A has no
        // business toasting agent B's tool calls — the rail's unread badge is
        // where B's activity shows. Toasts without an agentId stay global.
        agentId: opts.agentId ?? null,
    };
    ctx.fns.procs.events.emit({ event });
    return event;
}
