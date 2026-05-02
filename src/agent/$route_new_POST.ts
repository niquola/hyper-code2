export default async function (ctx: Context, _session: any, req: Request) {
    const form = await req.formData();
    const model = (form.get("model") as string)?.trim()
        || ctx.fns.settings?.modelDefault?.(ctx)
        || ctx.env.MODEL
        || "minimax/minimax-m2.7";
    const systemPromptRaw = (form.get("systemPrompt") as string)?.trim();
    // Tools array stays empty — markers protocol uses plain content, no native
    // function-calling schemas. Per-agent override, if any, lives in systemPrompt.
    const agent = ctx.fns.agent.start(ctx, { model, systemPrompt: systemPromptRaw || "", tools: [] });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(agent.id)}` } });
}
