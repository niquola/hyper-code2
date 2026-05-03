// The agent turn loop. Marker-protocol only — we don't run native function
// calls. The model emits §eval/write/bash/html markers in plain content;
// parseMarkers extracts them; executeMarker runs each one, persists the
// marker message + tool_call event + synthetic §result feedback. The loop
// continues until the model returns a response with no markers (pure prose).
//
// All the per-marker mechanics live in ctx.fns.agent.executeMarker. This
// file is intentionally small — orchestration only.
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
        const { text, usage } = await ctx.fns.llm.stream(ctx, agent, { signal: ac.signal });

        const { prose, calls, errors } = ctx.fns.agent.parseMarkers(String(text ?? ''));

        // No markers and no parser errors — close the turn cleanly.
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

        // Persist the prose chunk that preceded the first marker, if any.
        // Splitting prose from markers gives the model clean per-call pairing
        // on later turns: [assistant: prose?] → (assistant<marker> → user<result>)+.
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
            await ctx.fns.agent.executeMarker(ctx, agent, call, { usage });
        }

        // Parser errors (misplaced markers etc) tail the chain as a single
        // user message so the model can self-correct on the next turn.
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
