export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const fd = await opts.req.formData();
    try { await ctx.fns.llm.completeAnthropicOAuth({ input: String(fd.get("authorization") ?? "") }); }
    catch (e: any) {
        const root: any = ((ctx.state as any).llm ??= {});
        const store: any = (root.anthropicOAuth ??= { pending: new Map() });
        store.lastError = String(e?.message ?? "Anthropic OAuth login failed");
    }
    return new Response(null, { status: 303, headers: { location: "/llms" } });
}
