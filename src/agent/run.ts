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
    _session: Session | null,
    opts: { agent: types.agent.Agent; userText: string; userMessageAlreadyAppended?: boolean },
) {
    const { agent, userText } = opts;
    const ac = new AbortController();
    agent.abortController = ac;

    if (!opts.userMessageAlreadyAppended) {
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: userText });
        await ctx.fns.session.syncAgentState({ agent });
    }

    while (true) {
        const { text, usage, finishReason } = await ctx.fns.llm.stream({ agent, signal: ac.signal });

        const { prose, calls, errors } = ctx.fns.agent.parseMarkers({ text: String(text ?? '') });

        // A reply cut off by the token limit may end mid-marker — a §write with
        // half a file, an §eval with half a statement. Executing that corrupts
        // state, so NOTHING runs: the model is told to re-issue, smaller.
        if (finishReason === 'length' && calls.length > 0) {
            const hint = 'Your reply hit the token limit and was truncated mid-marker. NOTHING was executed. ' +
                'Re-issue the marker(s) in a shorter form: split large §write bodies into several calls, ' +
                'or produce big content via §eval + Bun.write in chunks.';
            await ctx.fns.session.appendErrorEvent({ id: agent.id, error: 'reply truncated at token limit — markers not executed' });
            await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user', content: `§error:truncated\n${hint}`, excluded_from_cursor: true,
            } });
            await ctx.fns.session.syncAgentState({ agent });
            continue;
        }

        // No markers and no parser errors — close the turn cleanly.
        if (calls.length === 0 && errors.length === 0) {
            // Skip empty completions entirely — they produce phantom bubbles
            // and have no informational value to either UI or LLM.
            if (!text || !String(text).trim()) {
                return { text: text ?? '', usage };
            }
            const append = await ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: text } });
            await ctx.fns.session.syncAgentState({ agent });
            const html = await ctx.fns.markdown.render({ source: prose || text || '' });
            await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
                text: prose || text || '', html, usage, messageIdx: append.idx,
            } });
            await ctx.fns.session.syncAgentState({ agent });
            return { text, usage };
        }

        // Persist the prose chunk that preceded the first marker, if any.
        // Splitting prose from markers gives the model clean per-call pairing
        // on later turns: [assistant: prose?] → (assistant<marker> → user<result>)+.
        if (prose.trim()) {
            const proseAppend = await ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: prose } });
            await ctx.fns.session.syncAgentState({ agent });
            const proseHtml = await ctx.fns.markdown.render({ source: prose });
            await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
                text: prose, html: proseHtml, usage, messageIdx: proseAppend.idx,
            } });
            await ctx.fns.session.syncAgentState({ agent });
        }

        for (const call of calls) {
            await ctx.fns.agent.executeMarker({ agent, call, usage });
        }

        // Parser errors (misplaced markers etc) tail the chain as a single
        // user message so the model can self-correct on the next turn.
        if (errors.length > 0) {
            for (const e of errors) {
                await ctx.fns.session.appendErrorEvent({ id: agent.id, error: e.hint });
            }
            const errText = errors.map(e => ctx.fns.agent.formatMarkerError({ error: e })).join('\n\n');
            await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user', content: errText, excluded_from_cursor: true,
            } });
            await ctx.fns.session.syncAgentState({ agent });
        }
    }
}
