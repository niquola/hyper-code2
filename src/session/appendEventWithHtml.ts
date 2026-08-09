// Build an event, render its bubble HTML into the right cache field, and append.
// Centralises the render-then-append step shared by every typed append*Event
// wrapper. The cached bubble goes in `eventHtml` for every type EXCEPT
// tool_call, which stores it in `html` (assistant already uses `html` for its
// markdown body); the events.html route reads them accordingly.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; type: string; payload?: any; ts?: number },
): Promise<{ idx: number }> {
    const { id, type } = opts;
    const event = { type, ...(opts.payload ?? {}) } as any;
    const html = await ctx.fns.agent.renderEventHtml({ event, agentId: id });
    if (type === "tool_call") event.html = html;
    else event.eventHtml = html;
    return ctx.fns.session.appendEvent({ id, event, ts: opts.ts });
}
