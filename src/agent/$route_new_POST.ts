export default async function (ctx: Context, _session: any, req: Request) {
    const form = await req.formData();
    const model = (form.get("model") as string)?.trim()
        || ctx.fns.settings?.modelDefault?.(ctx)
        || ctx.env.MODEL
        || "minimax/minimax-m2.7";

    const presets = await ctx.fns.agent.listPromptPresets(ctx);
    const selected = form.getAll("promptPreset")
        .map(x => String(x))
        .filter(id => Object.prototype.hasOwnProperty.call(presets, id));

    const presetText = selected
        .map(id => (presets as Record<string, { text?: string }>)[id]?.text?.trim())
        .filter(Boolean)
        .join("\n\n");

    const systemPromptRaw = (form.get("systemPrompt") as string)?.trim() || "";
    const systemPrompt = [presetText, systemPromptRaw].filter(Boolean).join("\n\n");

    const agent = ctx.fns.agent.start(ctx, { model, systemPrompt });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(agent.id)}` } });
}
