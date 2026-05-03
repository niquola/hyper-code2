export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id] ?? ctx.fns.session.load(ctx, { id });
    if (!agent) return Response.json({ error: "not found" }, { status: 404 });
    const form = await req.formData();
    const idx = Number(form.get("idx"));
    const mode = String(form.get("mode") || "one");
    const res = mode === "from"
        ? ctx.fns.session.truncateMessagesFrom(ctx, { id, from: idx })
        : ctx.fns.session.deleteMessageAt(ctx, { id, idx });
    if (!res.ok) return Response.json({ error: res.reason || "delete failed" }, { status: 400 });
    ctx.fns.session.syncAgentState(ctx, { agent });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(id)}` } });
}
