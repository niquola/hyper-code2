/** Marks one agent read through the newest event visible to the native client. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const row = ((await ctx.fns.procs.db.select({
        sql: "SELECT MAX(ts) AS ts FROM events WHERE agent_id = ?",
        params: [id],
    })) as any[])[0];
    if (row?.ts == null) {
        const exists = ((await ctx.fns.procs.db.select({ sql: "SELECT 1 FROM agents WHERE id = ?", params: [id] })) as any[])[0];
        if (!exists) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
    }
    const seenAt = row?.ts == null ? Date.now() : Number(row.ts);
    await ctx.fns.procs.db.run({
        sql: "INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
        params: [`seen-at:${id}`, String(seenAt)],
    });
    return Response.json({ version: 1, ok: true, agentId: id, seenAt });
}
