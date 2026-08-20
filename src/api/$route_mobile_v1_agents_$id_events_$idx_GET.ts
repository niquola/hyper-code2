/** Returns bounded tool-call details for a native mobile details sheet. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const idx = Number(opts.params.idx);
    if (!Number.isInteger(idx) || idx < 0) return Response.json({ error: "invalid_event", message: "Invalid event index" }, { status: 400 });
    const row = ((await ctx.fns.procs.db.select({
        sql: "SELECT idx, type, payload, ts FROM events WHERE agent_id = ? AND idx = ?",
        params: [id, idx],
    })) as any[])[0];
    if (!row) return Response.json({ error: "not_found", message: "Event not found" }, { status: 404 });
    const event = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
    if (event?.type !== "tool_call" && event?.type !== "tool_result") return Response.json({ error: "not_a_tool", message: "Event is not a tool call" }, { status: 400 });
    const truncate = (value: any, max: number) => {
        const text = typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2);
        return { text: text.slice(0, max), truncated: text.length > max };
    };
    const args = truncate(event.args, 40_000);
    const result = truncate(event.result ?? event.text ?? "", 120_000);
    return Response.json({
        version: 1,
        event: {
            idx: Number(row.idx), ts: Number(row.ts), type: String(event.type), name: String(event.name ?? "tool"),
            args: args.text, argsTruncated: args.truncated,
            result: result.text, resultTruncated: result.truncated,
            isError: event.isError === true,
        },
    });
}
