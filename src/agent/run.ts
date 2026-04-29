async function highlightResult(ctx: Context, output: string): Promise<string> {
    const trimmed = output.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
            return await ctx.fns.markdown.highlight(ctx, pretty, "json");
        } catch { /* not JSON */ }
    }
    return await ctx.fns.markdown.highlight(ctx, output, "javascript");
}

export default async function (ctx: Context, agent: types.agent.Agent, userText: string) {
    const ac = new AbortController();
    agent.abortController = ac;

    ctx.fns.session?.appendUserMessage?.(ctx, agent.id, userText);
    ctx.fns.session?.syncAgentState?.(ctx, agent);

    while (true) {
        const { text, thinking, toolCalls, usage } = await ctx.fns.llm.stream(ctx, agent, {
            signal: ac.signal,
        });

        if (thinking) {
            ctx.fns.session?.appendThinkingEvent?.(ctx, agent.id, thinking);
            ctx.fns.session?.syncAgentState?.(ctx, agent);
        }

        const assistantMsg: any = {};
        if (text) assistantMsg.content = text;
        if (toolCalls.length > 0) {
            assistantMsg.tool_calls = toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
            }));
        }
        ctx.fns.session?.appendAssistantMessage?.(ctx, agent.id, assistantMsg);
        ctx.fns.session?.syncAgentState?.(ctx, agent);

        if (toolCalls.length === 0) {
            const html = await ctx.fns.markdown.render(ctx, text);
            ctx.fns.session?.appendAssistantEvent?.(ctx, agent.id, { text, html, usage });
            ctx.fns.session?.syncAgentState?.(ctx, agent);
            return { text, usage };
        }

        for (const tc of toolCalls) {
            let output: string;
            let isError = false;
            let args: any;
            try {
                args = JSON.parse(tc.arguments || "{}");
                if (tc.name === "evalCode") {
                    ctx.fns.session?.syncAgentState?.(ctx, agent);
                    const result = await ctx.fns.repl.eval(ctx, args.code, { agent });
                    output = typeof result === "string" ? result : Bun.inspect(result);
                } else {
                    output = `Unknown tool: ${tc.name}`;
                    isError = true;
                }
            } catch (e: any) {
                output = `Error: ${e.message}`;
                isError = true;
            }
            const argsHtml = tc.name === "evalCode" && typeof args?.code === "string"
                ? await ctx.fns.markdown.highlight(ctx, args.code, "ts")
                : await ctx.fns.markdown.highlight(ctx, JSON.stringify(args, null, 2), "json");
            const resultHtml = await highlightResult(ctx, output);
            ctx.fns.session?.appendToolCallEvent?.(ctx, agent.id, { name: tc.name, args, result: output, argsHtml, resultHtml, isError });
            ctx.fns.session?.appendToolMessage?.(ctx, agent.id, tc.id, output);
            ctx.fns.session?.syncAgentState?.(ctx, agent);
        }
    }
}
