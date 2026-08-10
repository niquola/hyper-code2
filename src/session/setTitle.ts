export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; title: string },
): Promise<string> {
    const title = String(opts.title ?? "").trim().slice(0, 120);
    const result = await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET title = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL",
        params: [title, Date.now(), opts.id],
    });
    if (!result || Number((result as any).changes ?? (result as any).rowCount ?? 0) === 0) {
        const rows = await ctx.fns.procs.db.select({
            sql: "SELECT id FROM agents WHERE id = ? AND archived_at IS NULL",
            params: [opts.id],
        });
        if (!rows.length) throw new Error(`agent not found: ${opts.id}`);
    }
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) agent.title = title;
    await ctx.fns.events.emitAgentsChanged({ agentId: opts.id, reason: "title" });
    return title;
}