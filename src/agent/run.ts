async function highlightResult(ctx: Context, output: string): Promise<string> {
    const trimmed = output.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
            return await ctx.fns.markdown.highlight(ctx, pretty, "json");
        } catch {}
    }
    return await ctx.fns.markdown.highlight(ctx, output, "javascript");
}

export default async function (ctx: Context, agent: types.agent.Agent, userText: string) {
    const ac = new AbortController();
    agent.abortController = ac;

    await ctx.fns.session.appendUserMessage(ctx, agent.id, userText);
    ctx.fns.session.syncAgentState(ctx, agent);

    while (true) {
        let liveThinking = "";
        const emitThinkingDone = () => ctx.fns.events.emit(ctx, { type: "agent.thinking.done", agentId: agent.id });
        const { text, thinking, toolCalls, usage } = await ctx.fns.llm.stream(ctx, agent, {
            signal: ac.signal,
            onEvent: (ev: any) => {
                if (ev?.type === "thinking_delta" && typeof ev.delta === "string" && ev.delta.length > 0) {
                    liveThinking += ev.delta;
                    ctx.fns.events.emit(ctx, { type: "agent.thinking.delta", agentId: agent.id, delta: ev.delta, text: liveThinking });
                }
            },
        });


        const assistantMsg: any = {};
        if (text) assistantMsg.content = text;
        if (toolCalls.length > 0) {
            assistantMsg.tool_calls = toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
            }));
        }
        const assistantAppend = ctx.fns.session.appendAssistantMessage(ctx, agent.id, assistantMsg);
        ctx.fns.session.syncAgentState(ctx, agent);

        if (toolCalls.length === 0) {
            const html = await ctx.fns.markdown.render(ctx, text);
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, { text, html, usage, messageIdx: assistantAppend.idx });
            ctx.fns.session.syncAgentState(ctx, agent);
            emitThinkingDone();
            return { text, usage };
        }

        emitThinkingDone();
        for (const tc of toolCalls) {
            let output;
            let isError = false;
            let args;
            try {
                args = JSON.parse(tc.arguments || "{}");
                if (tc.name === "evalCode") {
                    ctx.fns.session.syncAgentState(ctx, agent);
                    const result = await ctx.fns.repl.eval(ctx, args.code, { agent });
                    output = typeof result === "string" ? result : Bun.inspect(result);
                } else {
                    output = 'Unknown tool: ' + tc.name;
                    isError = true;
                }
            } catch (e: any) {
                output = 'Error: ' + e.message;
                isError = true;
            }
            const argsHtml = tc.name === "evalCode" && typeof args?.code === "string"
                ? await ctx.fns.markdown.highlight(ctx, args.code, "ts")
                : await ctx.fns.markdown.highlight(ctx, JSON.stringify(args, null, 2), "json");
            const resultHtml = await highlightResult(ctx, output);
            await ctx.fns.session.appendToolCallEvent(ctx, agent.id, { name: tc.name, args, result: output, argsHtml, resultHtml, isError });
            ctx.fns.session.appendToolMessage(ctx, agent.id, tc.id, output);
            ctx.fns.session.syncAgentState(ctx, agent);
        }
    }
}
