/** Sets durable shared pin state for one agent. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const exists = ((await ctx.fns.procs.db.select({ sql: "SELECT 1 FROM agents WHERE id = ?", params: [id] })) as any[])[0];
    if (!exists) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
    let body: any;
    try { body = await opts.req.json(); } catch { body = {}; }
    const pinned = body?.pinned !== false;
    const key = `mobile-pin-agent:${id}`;
    if (pinned) await ctx.fns.procs.db.run({ sql: "INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", params: [key, String(Date.now())] });
    else await ctx.fns.procs.db.run({ sql: "DELETE FROM kv WHERE key = ?", params: [key] });
    return Response.json({ version: 1, agentId: id, pinned });
}
