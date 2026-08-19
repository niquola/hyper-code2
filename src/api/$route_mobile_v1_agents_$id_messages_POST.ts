/** Appends a native mobile user message and schedules the target agent. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = await ctx.fns.session.load({ id });
        if (agent) { (ctx.state as any).agent ??= {}; (ctx.state as any).agent[id] = agent; }
    }
    if (!agent) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });

    let body: any;
    try { body = await opts.req.json(); }
    catch { return Response.json({ error: "invalid_json", message: "Expected a JSON body" }, { status: 400 }); }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return Response.json({ error: "empty_message", message: "Message text is required" }, { status: 400 });
    if (text.length > 200_000) return Response.json({ error: "message_too_large", message: "Message is too large" }, { status: 413 });

    const ts = Date.now();
    const appended = await ctx.fns.session.appendMessage({ id, message: { role: "user", content: text }, ts });
    const event: any = { type: "user", text, messageIdx: appended.idx, ts };
    event.html = await ctx.fns.agent.renderEventHtml({ event, agentId: id });
    const eventIdx = await ctx.fns.session.appendEvent({ id, event, ts });
    await ctx.fns.session.syncAgentState({ agent });

    const debounceMs = Math.min(30_000, Math.max(0, Number(body?.debounceMs ?? 100) || 0));
    const sendAt = Date.now() + debounceMs;
    await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET next_run_at = GREATEST(COALESCE(next_run_at, 0), ?), updated_at = ? WHERE id = ?",
        params: [sendAt, Date.now(), id],
    });
    ctx.fns.agent.wakeWorker({});
    return Response.json({ version: 1, ok: true, messageIdx: appended.idx, eventIdx: eventIdx.idx, sendAt }, { status: 202 });
}
