const EVAL_CODE_TOOL = {
    name: "evalCode",
    description: "Execute a JavaScript expression or statements. Returns the serialized result.",
    parameters: {
        type: "object",
        properties: { code: { type: "string", description: "JS code to evaluate" } },
        required: ["code"],
    },
};

export default async function (ctx: Context, _session: any, req: Request) {
    const form = await req.formData();
    const model = (form.get("model") as string)?.trim() || ctx.env.MODEL || "minimax/minimax-m2.7";
    const systemPromptRaw = (form.get("systemPrompt") as string)?.trim();
    const systemPrompt = systemPromptRaw || await ctx.fns.agent.systemPrompt(ctx);
    const agent = ctx.fns.agent.start(ctx, { model, systemPrompt, tools: [EVAL_CODE_TOOL] });
    try { ctx.fns.session?.save?.(ctx, agent); } catch (e: any) { console.error("[session.save]", e?.message); }
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(agent.id)}` } });
}
