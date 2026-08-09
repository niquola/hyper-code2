export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? ctx.fns.session.load({ id });
    if (!agent) return Response.json({ error: "not found" }, { status: 404 });
    const form = await opts.req.formData();
    const idx = Number(form.get("idx"));
    const mode = String(form.get("mode") || "one");
    const res = mode === "from"
        ? ctx.fns.session.truncateMessagesFrom({ id, from: idx })
        : ctx.fns.session.deleteMessageAt({ id, idx });
    if (!res.ok) return Response.json({ error: res.reason || "delete failed" }, { status: 400 });
    ctx.fns.session.syncAgentState({ agent });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(id)}` } });
}
