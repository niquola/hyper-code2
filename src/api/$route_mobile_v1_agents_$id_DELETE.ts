/** Permanently deletes one agent from the native chat menu. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id];
    if (agent) await ctx.fns.agent.clear({ agent });
    const result = await ctx.fns.session.delete({ id });
    delete (ctx.state as any).agent?.[id];
    return result.ok ? Response.json({ version: 1, ok: true, agentId: id }) : Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
}
