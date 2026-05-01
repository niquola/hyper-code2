// Marker-protocol run loop. Alternative to run.ts when agent.protocol === 'markers'.
//
// Differences from run.ts:
// - Sends NO `tools[]` to the LLM. Model emits markers in plain content.
// - Parses content for ///eval and ///write:<path> markers (parseMarkers).
// - Executes each marker, appends a synthetic user message with results
//   (formatMarkerResult), and loops until the model returns a response with
//   no markers (pure prose).
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

export default async function (
    ctx: Context,
    agent: types.agent.Agent,
    userText: string,
    opts: { userMessageAlreadyAppended?: boolean } = {},
) {
    const ac = new AbortController();
    agent.abortController = ac;

    if (!opts.userMessageAlreadyAppended) {
        await ctx.fns.session.appendUserMessage(ctx, agent.id, userText);
        ctx.fns.session.syncAgentState(ctx, agent);
    }

    // Mark protocol on scratchpad so fullSystemPrompt picks the markers layer
    // even if the global setting is something else.
    (agent.scratchpad as any).protocol = 'markers';

    while (true) {
        // Strip tools so the LLM does not advertise function-calling. The
        // system prompt is composed by fullSystemPrompt based on protocol.
        const savedTools = agent.tools;
        agent.tools = [];

        let text: string, usage: any;
        try {
            ({ text, usage } = await ctx.fns.llm.stream(ctx, agent, { signal: ac.signal }));
        } finally {
            agent.tools = savedTools;
        }

        const { prose, calls } = ctx.fns.agent.parseMarkers(String(text ?? ''));

        // Always persist the assistant turn verbatim (markers + prose). The model
        // sees its own emitted content on subsequent turns, same as function-calling
        // role:assistant messages with tool_calls.
        const assistantAppend = ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: text });
        ctx.fns.session.syncAgentState(ctx, agent);

        if (calls.length === 0) {
            const html = await ctx.fns.markdown.render(ctx, prose || text || '');
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                text: prose || text || '',
                html,
                usage,
                messageIdx: assistantAppend.idx,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
            return { text, usage };
        }

        // If the assistant wrote any prose before the first marker, render it
        // as an assistant bubble — otherwise the natural-language explanation
        // is lost from the UI (only tool-call bubbles would show).
        if (prose.trim()) {
            const proseHtml = await ctx.fns.markdown.render(ctx, prose);
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                text: prose, html: proseHtml, usage, messageIdx: assistantAppend.idx,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }

        // Execute each call sequentially, render UI events, and accumulate
        // result blocks for one synthetic user message.
        const resultBlocks: string[] = [];
        for (const call of calls) {
            let output = '';
            let isError = false;
            try {
                if (call.kind === 'eval') {
                    // repl.eval now always returns a string (Jupyter-style buffer).
                    output = await ctx.fns.repl.eval(ctx, call.content, { agent });
                } else if (call.kind === 'write') {
                    await ctx.fns.files.write(ctx, call.path, call.content);
                    const lines = call.content.split('\n').length;
                    output = `wrote ${call.path} (${call.content.length} bytes, ${lines} lines)`;
                }
            } catch (e: any) {
                output = 'Error: ' + (e?.message ?? String(e));
                isError = true;
            }

            const argsHtml = call.kind === 'eval'
                ? await ctx.fns.markdown.highlight(ctx, call.content, 'ts')
                : await ctx.fns.markdown.highlight(ctx, call.content, 'ts');
            const resultHtml = await highlightResult(ctx, output);
            await ctx.fns.session.appendToolCallEvent(ctx, agent.id, {
                name: call.kind,
                args: call.kind === 'write' ? { path: call.path, content: call.content } : { code: call.content },
                result: output,
                argsHtml,
                resultHtml,
                isError,
            });

            resultBlocks.push(ctx.fns.agent.formatMarkerResult(call, output, isError));
        }

        // Feed all results back as a single user message so the model continues
        // on the next turn. Use raw appendMessage (writes only to messages table) —
        // appendUserMessage would ALSO emit a user-event, which the UI would render
        // as a duplicate bubble next to the tool-call bubble we already added above.
        const resultText = resultBlocks.join('\n\n');
        ctx.fns.session.appendMessage(ctx, agent.id, { role: 'user', content: resultText });
        ctx.fns.session.syncAgentState(ctx, agent);
    }
}
