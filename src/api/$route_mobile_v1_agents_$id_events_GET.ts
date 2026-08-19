/** Returns a bounded transcript event page for the native mobile chat. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const exists = ((await ctx.fns.procs.db.select({ sql: "SELECT 1 FROM agents WHERE id = ?", params: [id] })) as any[])[0];
    if (!exists) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });

    const url = new URL(opts.req.url);
    const afterRaw = url.searchParams.get("after");
    const beforeRaw = url.searchParams.get("before");
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 80) || 80));
    const events = beforeRaw != null
        ? await ctx.fns.session.getEvents({ id, beforeIdx: Math.max(0, Number(beforeRaw) || 0), limit })
        : await ctx.fns.session.getEvents({ id, fromIdx: Math.max(0, Number(afterRaw) || 0), limit });
    const maxIdx = await ctx.fns.session.getMaxEventIdx({ id });
    const status = ((await ctx.fns.procs.db.select({ sql: "SELECT run_state, next_run_at, last_error FROM agents WHERE id = ?", params: [id] })) as any[])[0];
    const isRunning = status?.run_state === "running" || status?.run_state === "claimed" || status?.next_run_at != null;

    const mobileEvents = events
        .filter((event: any) => ["user", "assistant", "error", "tool_call", "tool_result", "stop"].includes(String(event.type)))
        .map((event: any) => ({
            idx: Number(event.idx),
            ts: Number(event.ts),
            type: String(event.type),
            text: typeof event.text === "string" ? event.text : (typeof event.error === "string" ? event.error : null),
            name: typeof event.name === "string" ? event.name : null,
            isError: event.isError === true,
            attachments: Array.isArray(event.attachments) ? event.attachments : [],
        }));

    return Response.json({
        version: 1,
        agentId: id,
        events: mobileEvents,
        nextAfter: maxIdx + 1,
        hasOlder: events.length > 0 && Number(events[0]?.idx ?? 0) > 0,
        isRunning,
        runState: status?.run_state || "idle",
        lastError: status?.last_error || null,
    });
}
