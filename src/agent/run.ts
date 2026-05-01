async function highlightResult(ctx: Context, output: string): Promise<string> {
    const safeOutput = String(output ?? "");
    const trimmed = safeOutput.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            const pretty = JSON.stringify(JSON.parse(trimmed), null, 2);
            return await ctx.fns.markdown.highlight(ctx, pretty, "json");
        } catch {}
    }
    return await ctx.fns.markdown.highlight(ctx, safeOutput, "javascript");
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

async function safeRenderToolEvent(
    ctx: Context,
    agentId: string,
    payload: { name: string; args: any; result: string; isError: boolean },
) {
    const safeArgs = payload?.args ?? {};
    const code = typeof safeArgs?.code === "string" ? safeArgs.code : undefined;
    const safeResult = String(payload?.result ?? "");

    try {
        const argsHtml = code != null
            ? await ctx.fns.markdown.highlight(ctx, code, "ts")
            : await ctx.fns.markdown.highlight(ctx, JSON.stringify(safeArgs, null, 2), "json");
        const resultHtml = await highlightResult(ctx, safeResult);

        await ctx.fns.session.appendToolCallEvent(ctx, agentId, {
            name: payload.name,
            args: safeArgs,
            result: safeResult,
            argsHtml,
            resultHtml,
            isError: !!payload.isError,
        });
        return;
    } catch (e: any) {
        try {
            const argsHtml = "<pre><code>" + Bun.escapeHTML(JSON.stringify(safeArgs, null, 2)) + "</code></pre>";
            const resultHtml = "<pre><code>" + Bun.escapeHTML(safeResult) + "</code></pre>";
            await ctx.fns.session.appendToolCallEvent(ctx, agentId, {
                name: payload.name,
                args: safeArgs,
                result: safeResult,
                argsHtml,
                resultHtml,
                isError: !!payload.isError,
            });
            return;
        } catch {}

        try {
            await ctx.fns.session.appendEvent(ctx, agentId, {
                type: "error",
                text: "tool event render failed: " + String(e?.message ?? e),
            });
        } catch {}
    }
}

export default async function (ctx: Context, agent: types.agent.Agent, userText: string, opts: { userMessageAlreadyAppended?: boolean } = {}) {
    // Protocol switch: native function-calling (default) vs marker protocol (experimental).
    // Per-agent override via agent.scratchpad.protocol; otherwise the declared agent.protocol setting.
    const protocol = (agent.scratchpad?.protocol as string)
        ?? ctx.fns.settings?.getString?.(ctx, { module: 'agent', scopeType: 'global', key: 'protocol' })
        ?? 'tool-calls';
    if (protocol === 'markers') {
        return ctx.fns.agent.runMarkers(ctx, agent, userText, opts);
    }

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
            let output = "";
            let isError = false;
            let args: any = {};
            try {
                args = JSON.parse(tc.arguments || "{}");
                if (tc.name === "evalCode") {
                    ctx.fns.session.syncAgentState(ctx, agent);
                    const result = await ctx.fns.repl.eval(ctx, args.code, { agent });
                    output = typeof result === "string" ? result : Bun.inspect(result);
                } else {
                    output = "Unknown tool: " + tc.name;
                    isError = true;
                }
            } catch (e: any) {
                output = "Error: " + String(e?.message ?? e);
                isError = true;
            }

            ctx.fns.session.appendToolMessage(ctx, agent.id, tc.id, output);
            ctx.fns.session.syncAgentState(ctx, agent);

            if (tc.name === "evalCode" && !isError) {
                excludeFailedEvalAttempts(ctx, agent.id);
            }

            await safeRenderToolEvent(ctx, agent.id, {
                name: tc.name,
                args,
                result: output,
                isError,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }
    }
}
