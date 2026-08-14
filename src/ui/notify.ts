// Push a toast to every open tab.
//
// `message` is the one line a reader scans; `body` is the detail they need when
// that line is not enough — a provider's 400 explanation, a stack, the tail of
// a failed command. `bodyHtml` is the same detail already syntax-highlighted,
// which is what a tool call sends: a shell command reads as a command and a
// file reads as its language, in the corner as much as in the transcript.
/** Performs the ui.notify runtime operation. */
/**
 * Push a toast to every open tab.
 * @param opts.message Notification title or message.
 * @param opts.body Response byte stream or notification body.
 * @param opts.bodyHtml HTML notification body.
 * @param opts.level Notification severity.
 * @param opts.html Initial or inner HTML content.
 * @param opts.agentId Target agent identifier.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Notification message. */ message: string;
        /** Request body sent to the model endpoint. */ body?: string;
        /** Value used for the body html option. */ bodyHtml?: string;
        /** Value used for the level option. */ level?: 'info' | 'warn' | 'error';
        /** Rendered HTML content. */ html?: string;
        /** Identifier of the agent whose scoped setting is used. */ agentId?: string },
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
