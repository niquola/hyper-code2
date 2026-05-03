export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (agent) ctx.fns.agent.clear(ctx, { agent });
    delete (ctx.state as any).agent?.[id];
    try { ctx.fns.session?.delete?.(ctx, id); } catch (e: any) { console.error("[session.delete]", e?.message); }
    return Response.json({ ok: true });
}
