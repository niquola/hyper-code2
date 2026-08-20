/** Manually compact an idle agent's effective model context. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming HTTP request containing optional focus instructions. */ req: Request;
    /** Route parameters containing the root agent id. */ params: Record<string, string>;
}) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return new Response("not found", { status: 404 });
    try {
        const form = await opts.req.formData();
        const result = await ctx.fns.agent.compactContext({ agent, instructions: String(form.get("instructions") ?? "") || undefined });
        if (result.status === "not_needed") await ctx.fns.ui.notify({ message: "Context already compact: there is not enough removable history yet.", level: "info" }).catch(() => undefined);
        return new Response(null, { status: 204, headers: { "HX-Refresh": "true", "X-Compaction-Status": result.status } });
    } catch (error: any) {
        return new Response(String(error?.message ?? error), { status: /running|already running/.test(String(error?.message)) ? 409 : 400 });
    }
}
