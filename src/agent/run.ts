// The agent turn loop. Marker-protocol only — we don't run native function
// calls. The model emits ///eval and ///write:<path> markers in plain content;
// parseMarkers extracts them, this loop executes each, appends a synthetic
// user message with the result (formatMarkerResult), and continues until the
// model returns a response with no markers (pure prose).
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

    while (true) {
        // No native tool schemas — markers protocol uses plain content.
        agent.tools = [];

        const { text, usage } = await ctx.fns.llm.stream(ctx, agent, { signal: ac.signal });

        const { prose, calls, errors } = ctx.fns.agent.parseMarkers(String(text ?? ''));

        // No markers and no parser errors — close the turn cleanly. Persist
        // the full assistant content verbatim (it's natural-language reply).
        if (calls.length === 0 && errors.length === 0) {
            // Skip empty completions entirely — they produce phantom bubbles
            // and have no informational value to either UI or LLM.
            if (!text || !String(text).trim()) {
                return { text: text ?? '', usage };
            }
            const append = ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: text });
            ctx.fns.session.syncAgentState(ctx, agent);
            const html = await ctx.fns.markdown.render(ctx, prose || text || '');
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                text: prose || text || '', html, usage, messageIdx: append.idx,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
            return { text, usage };
        }

        // We have markers (and possibly errors). Split the assistant turn
        // into a chain so the LLM sees clean per-call pairing on later turns:
        //   [assistant: prose?] → (assistant<marker> → user<result>)+ → [user: errors?]
        // Without this, multi-marker turns produce one giant assistant blob
        // and one user blob with all results stacked — model loses sight of
        // which result came from which call.

        if (prose.trim()) {
            const proseAppend = ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: prose });
            ctx.fns.session.syncAgentState(ctx, agent);
            const proseHtml = await ctx.fns.markdown.render(ctx, prose);
            await ctx.fns.session.appendAssistantEvent(ctx, agent.id, {
                text: prose, html: proseHtml, usage, messageIdx: proseAppend.idx,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }

        for (const call of calls) {
            // Persist THIS marker as its own assistant message — paired with
            // its own result message immediately after.
            const markerText = call.kind === 'write'
                ? `///write:${call.path}\n${call.content}`
                : `///eval\n${call.content}`;
            ctx.fns.session.appendAssistantMessage(ctx, agent.id, { content: markerText });
            ctx.fns.session.syncAgentState(ctx, agent);

            let output = '';
            let isError = false;
            try {
                if (call.kind === 'eval') {
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

            const argsHtml = await ctx.fns.markdown.highlight(ctx, call.content, 'ts');
            const resultHtml = await highlightResult(ctx, output);
            await ctx.fns.session.appendToolCallEvent(ctx, agent.id, {
                name: call.kind,
                args: call.kind === 'write' ? { path: call.path, content: call.content } : { code: call.content },
                result: output,
                argsHtml, resultHtml, isError,
            });

            const resultText = ctx.fns.agent.formatMarkerResult(call, output, isError);
            // Flag as tool-feedback so workerLoop's user-frontier ignores it —
            // otherwise every synthetic ///result row looks like a fresh user
            // input and retriggers another run (producing phantom bubbles).
            ctx.fns.session.appendMessage(ctx, agent.id, {
                role: 'user', content: resultText, excluded_from_cursor: true,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }

        // Parser errors (misplaced markers, etc.) tail the chain as one user
        // message so the model can self-correct on the next turn.
        if (errors.length > 0) {
            for (const e of errors) {
                await ctx.fns.session.appendErrorEvent(ctx, agent.id, e.hint);
            }
            const errText = errors.map(e => ctx.fns.agent.formatMarkerError(e)).join('\n\n');
            ctx.fns.session.appendMessage(ctx, agent.id, {
                role: 'user', content: errText, excluded_from_cursor: true,
            });
            ctx.fns.session.syncAgentState(ctx, agent);
        }
    }
}
