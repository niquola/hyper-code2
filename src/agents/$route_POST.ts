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
    let body: any = {};
    try { body = await req.json(); } catch { /* allow empty */ }
    const model = body.model || ctx.env.MODEL || "minimax/minimax-m2.7";
    const systemPrompt = body.systemPrompt || await ctx.fns.agent.systemPrompt(ctx);
    const agent = ctx.fns.agent.start(ctx, { model, systemPrompt, tools: [EVAL_CODE_TOOL] });
    return Response.json({ id: agent.id, model: agent.model });
}
