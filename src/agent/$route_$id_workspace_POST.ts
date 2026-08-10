export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { req: Request; params: Record<string, string> },
) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return new Response("Not Found", { status: 404 });

    const form = await opts.req.formData();
    try {
        await ctx.fns.workspace.set({ agent, dir: String(form.get("workspaceDir") ?? "") });
    } catch (error: any) {
        return new Response(error?.message ?? "Invalid workspace", { status: 400 });
    }

    return new Response(null, {
        status: 303,
        headers: { location: `/agent/${encodeURIComponent(id)}` },
    });
}