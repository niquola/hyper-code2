export default async function (ctx: Context, _session: any, req: Request) {
    const url = new URL(req.url);
    const offset = Number(url.searchParams.get("offset") ?? "0") || 0;
    const agent = (ctx.state as any).agent?.default;
    if (!agent) return Response.json({ events: [], nextOffset: 0, isStreaming: false });
    return Response.json({
        events: agent.events.slice(offset),
        nextOffset: agent.events.length,
        isStreaming: agent.isStreaming,
    });
}
