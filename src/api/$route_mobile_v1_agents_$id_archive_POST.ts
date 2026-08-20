/** Archives one agent from the native chat list. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const exists = ((await ctx.fns.procs.db.select({ sql: "SELECT 1 FROM agents WHERE id = ?", params: [id] })) as any[])[0];
    if (!exists) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET archived_at = ?, updated_at = ? WHERE id = ?", params: [Date.now(), Date.now(), id] });
    await ctx.fns.events.emitAgentsChanged({ agentId: id, reason: "archive" });
    return Response.json({ version: 1, ok: true, agentId: id, archived: true });
}
