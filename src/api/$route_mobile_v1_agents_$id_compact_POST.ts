/** Compacts one idle agent context for the native chat menu. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
    let body: any = {};
    try { body = await opts.req.json(); } catch {}
    try {
        const result = await ctx.fns.agent.compactContext({ agent, instructions: typeof body.instructions === "string" && body.instructions.trim() ? body.instructions.trim() : undefined });
        return Response.json({ version: 1, ok: true, status: result.status });
    } catch (error: any) {
        const message = String(error?.message ?? error);
        return Response.json({ error: "compact_failed", message }, { status: /running|already running/i.test(message) ? 409 : 400 });
    }
}
