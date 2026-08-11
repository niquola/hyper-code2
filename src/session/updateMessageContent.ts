// Fill in a message that was written as a placeholder.
//
// A tool result row is created the moment its call is — empty, marked pending —
// so the transcript is never in a state a provider refuses. This is what turns
// it into the real answer once the tool returns.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; idx: number; content: any; ts?: number },
): Promise<{ changed: number }> {
    // Same shape rule as appendMessage: prose stays text, structured
    // (multimodal) content is stored as JSON in the same column.
    const content = (typeof opts.content === "string" || opts.content == null
        ? String(opts.content ?? "")
        : JSON.stringify(opts.content)).replaceAll("\u0000", "\uFFFD");
    const res = await ctx.fns.procs.db.run({
        sql: "UPDATE messages SET content = ? WHERE agent_id = ? AND idx = ?",
        params: [content, opts.id, opts.idx],
    });
    await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET updated_at = ? WHERE id = ?",
        params: [opts.ts ?? Date.now(), opts.id],
    });
    return { changed: res.changes };
}
