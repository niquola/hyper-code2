export default async function (ctx: Context, _session: any, req: Request) {
    const form = await req.formData();
    const model = (form.get("model") as string)?.trim()
        || ctx.fns.settings?.modelDefault?.(ctx)
        || ctx.env.MODEL
        || "minimax/minimax-m2.7";
    const systemPromptRaw = (form.get("systemPrompt") as string)?.trim();
    const agent = ctx.fns.agent.start(ctx, { model, systemPrompt: systemPromptRaw || "" });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(agent.id)}` } });
}
