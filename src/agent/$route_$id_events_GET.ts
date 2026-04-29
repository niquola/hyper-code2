export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (!agent) return Response.json({ error: "not found" }, { status: 404 });
    const url = new URL(req.url);
    const offset = Number(url.searchParams.get("offset") ?? "0") || 0;
    // Enrich each event with rendered HTML (assistant: eventHtml; others: html)
    // so the client just appends — SSR-style. Old events that pre-date the
    // refactor still get rendered on the fly here.
    const slice = await Promise.all(agent.events.slice(offset).map(async (ev: any) => {
        // assistant.html is only the inner markdown — its full bubble lives in
        // eventHtml. For other event types html IS the full bubble.
        const haveBubble = ev.eventHtml || (ev.type !== "assistant" && ev.html);
        if (haveBubble) return ev;
        const html = await ctx.fns.agent.renderEventHtml(ctx, ev);
        return { ...ev, eventHtml: html };
    }));
    return Response.json({
        id: agent.id,
        model: agent.model,
        events: slice,
        nextOffset: agent.events.length,
        isStreaming: agent.isStreaming,
    });
}
