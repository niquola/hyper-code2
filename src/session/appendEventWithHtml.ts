// Append a typed event.
//
// It used to render the bubble here and cache the HTML in the payload. That
// cache is gone: re-rendering a whole transcript measured at ~7 ms, while the
// cache cost hundreds of KB per agent AND froze old bubbles in whatever markup
// the renderer produced back then — improve the rendering and history kept the
// old look forever. Now every read renders fresh, so a change applies to the
// entire transcript at once, and events carry data (not markup).
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; type: string; payload?: any; ts?: number },
): Promise<{ idx: number }> {
    const event = { type: opts.type, ...(opts.payload ?? {}) } as any;
    return ctx.fns.session.appendEvent({ id: opts.id, event, ts: opts.ts });
}
