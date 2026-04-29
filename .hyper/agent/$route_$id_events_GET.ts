export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (!agent) return Response.json({ error: "not found" }, { status: 404 });
    const url = new URL(req.url);
    const offset = Number(url.searchParams.get("offset") ?? "0") || 0;
    const last = agent.events.at(-1) as any;
    const usage = last?.type === "assistant" ? (last.usage ?? null) : null;
    return Response.json({ id: agent.id, model: agent.model, events: agent.events.slice(offset), nextOffset: agent.events.length, isStreaming: agent.isStreaming, usage });
}
