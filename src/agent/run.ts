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

    agent.messages.push({ role: "user", content: userText });

    while (true) {
        const { text, thinking, toolCalls, usage } = await ctx.fns.llm.stream(ctx, agent, {
            signal: ac.signal,
        });

        if (thinking) agent.events.push({ type: "thinking", text: thinking });

        const assistantMsg: any = { role: "assistant" };
        if (text) assistantMsg.content = text;
        if (toolCalls.length > 0) {
            assistantMsg.tool_calls = toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
            }));
        }
        agent.messages.push(assistantMsg);

        // No tools → return the final text response
        if (toolCalls.length === 0) {
            const html = await ctx.fns.markdown.render(ctx, text);
            agent.events.push({ type: "assistant", text, html, usage });
            try { ctx.fns.session?.save?.(ctx, agent); } catch (e: any) { console.error("[session.save]", e?.message); }
            return { text, usage };
        }

        // Execute tool calls and append results to messages
        for (const tc of toolCalls) {
            let output: string;
            let isError = false;
            let args: any;
            try {
                args = JSON.parse(tc.arguments || "{}");
                if (tc.name === "evalCode") {
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
            agent.events.push({ type: "tool_call", name: tc.name, args, result: output, argsHtml, resultHtml, isError });
            agent.messages.push({ role: "tool", tool_call_id: tc.id, content: output });
        }

        // After one round of tool execution, loop back for model to see results
    }
}
