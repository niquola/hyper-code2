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

function findFailedEvalSpan(messages: any[]): null | { assistantIdx: number; toolIdx: number } {
    for (let i = messages.length - 1; i >= 1; i--) {
        const tool = messages[i];
        const assistant = messages[i - 1];
        if (tool?.role !== "tool") continue;
        if (assistant?.role !== "assistant" || !Array.isArray(assistant.tool_calls)) continue;

        const matchingCall = assistant.tool_calls.find((tc: any) => tc?.id === tool.tool_call_id && tc?.function?.name === "evalCode");
        if (!matchingCall) continue;

        const content = String(tool.content ?? "");
        if (!content.startsWith("Error: ")) continue;

        return { assistantIdx: i - 1, toolIdx: i };
    }
    return null;
}

function excludeFailedEvalAttempts(ctx: Context, agentId: string) {
    const messages = ctx.fns.session.getMessages(ctx, agentId, { includeExcluded: true });
    const span = findFailedEvalSpan(messages);
    if (!span) return { changed: 0 };

    let changed = 0;
    for (const idx of [span.assistantIdx, span.toolIdx]) {
        const row = ctx.fns.db.exec(
            ctx,
            'UPDATE messages SET excluded_from_llm = 1 WHERE agent_id = ? AND idx = ? AND COALESCE(excluded_from_llm, 0) = 0',
            [agentId, idx],
        );
        changed += Number(row?.changes ?? 0);
    }
    return { changed };
}

export default async function (ctx: Context, agent: types.agent.Agent, userText: string, opts: { userMessageAlreadyAppended?: boolean } = {}) {
    const ac = new AbortController();
    agent.abortController = ac;

    if (!opts.userMessageAlreadyAppended) {
        await ctx.fns.session.appendUserMessage(ctx, agent.id, userText);
        ctx.fns.session.syncAgentState(ctx, agent);
    }

    while (true) {
        const { text, thinking, toolCalls, usage } = await ctx.fns.llm.stream(ctx, agent, {
            signal: ac.signal,
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
            return { text, usage };
        }

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

            if (tc.name === "evalCode" && !isError) {
                excludeFailedEvalAttempts(ctx, agent.id);
            }

            ctx.fns.session.syncAgentState(ctx, agent);
        }
    }
}
