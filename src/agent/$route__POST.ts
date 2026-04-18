const EVAL_CODE_TOOL = {
    name: "evalCode",
    description: "Execute a JavaScript expression or statements. Returns the serialized result.",
    parameters: {
        type: "object",
        properties: { code: { type: "string", description: "JS code to evaluate" } },
        required: ["code"],
    },
};

const TOOLS = [EVAL_CODE_TOOL];

export default async function (ctx: Context, _session: any, req: Request) {
    const text = (await req.text()).trim();
    if (!text) return Response.json({ error: "empty input" }, { status: 400 });

    const store = ((ctx.state as any).agent ??= {});
    let agent = store.default;
    if (!agent) {
        agent = ctx.fns.agent.start(ctx, {
            model: ctx.env.MODEL ?? "minimax/minimax-m2.7",
            systemPrompt: await ctx.fns.agent.systemPrompt(ctx),
            tools: TOOLS,
        });
        store.default = agent;
    }

    if (agent.isStreaming) {
        return Response.json({ error: "agent busy" }, { status: 409 });
    }

    const offset = agent.events.length;
    agent.events.push({ type: "user", text });
    agent.isStreaming = true;
    queueMicrotask(async () => {
        try {
            await ctx.fns.agent.run(ctx, agent, text);
        } catch (e: any) {
            agent.events.push({ type: "error", error: e.message });
        } finally {
            agent.isStreaming = false;
        }
    });

    return Response.json({ offset, nextOffset: agent.events.length });
}
