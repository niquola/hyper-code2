// The agent turn loop. Tools are invoked as the provider's NATIVE function
// calls; there is no text protocol to parse, so there is no parse error to
// repair — the provider validated the envelope and ctx.fns.tools.validate
// validated the arguments before anything ran.
//
// One loop, one registry: every call goes through ctx.fns.tools.call over the
// $tool_ declarations, exactly like a call made by hand from the REPL.
//
// The loop ends on a reply with no tool calls — pure prose back to the user.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; userText: string; userMessageAlreadyAppended?: boolean },
) {
    const { agent, userText } = opts;
    const agentCtx: any = Object.create(ctx);
    agentCtx.session = ctx.fns.session.forAgent({ agent });
    ctx = agentCtx;
    const ac = new AbortController();
    agent.abortController = ac;

    if (!opts.userMessageAlreadyAppended) {
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: userText });
        await ctx.fns.session.syncAgentState({ agent });
    }

    let consumedUserIdx = -1;
    const MAX_TURNS = 60;
    let turns = 0;

    while (true) {
        if (++turns > MAX_TURNS) {
            await ctx.fns.session.appendErrorEvent({ id: agent.id, error: `run hit the ${MAX_TURNS}-turn cap — closing; send a message to continue` });
            await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user',
                content: `This run exceeded ${MAX_TURNS} tool cycles and was closed. Summarize where you are; the user can send a message to continue.`,
                excluded_from_cursor: true,
            } });
            await ctx.fns.session.syncAgentState({ agent });
            return { text: '', usage: null, consumedUserIdx };
        }

        // Steering: read the frontier BEFORE refreshing the transcript, so a
        // message landing between the two gets INTO the call without being
        // counted consumed (a harmless duplicate pass beats a lost message).
        const seen = ((await ctx.fns.procs.db.select({
            sql: "SELECT COALESCE(MAX(idx), -1) AS i FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
            params: [agent.id],
        })) as any[])[0];
        consumedUserIdx = Math.max(consumedUserIdx, Number(seen?.i ?? -1));
        await ctx.fns.session.syncAgentState({ agent });

        const { text, usage, finishReason, toolCalls = [] } = await ctx.fns.llm.stream({ agent, signal: ac.signal });
        const prose = String(text ?? '');

        // A reply cut off at the token limit can end mid-arguments: the JSON
        // never closed, so the call arrives as {__unparsed}. Executing that is
        // meaningless and the schema would complain about the wrong thing —
        // NOTHING runs, and the model is told what actually happened.
        if (finishReason === 'length' && toolCalls.some((c: any) => c?.args?.__unparsed !== undefined)) {
            await ctx.fns.session.appendErrorEvent({ id: agent.id, error: 'reply truncated at token limit — tool calls not executed' });
            await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user',
                content: 'Your reply hit the token limit and was cut off mid-call, so NOTHING was executed. '
                    + 'Re-issue the call with a smaller payload: split a large write into several calls, '
                    + 'or produce big content with eval instead of passing it as an argument.',
                excluded_from_cursor: true,
            } });
            await ctx.fns.session.syncAgentState({ agent });
            continue;
        }

        // The assistant turn is ONE row, carrying both what it said and what it
        // called — that pairing is what the next request replays.
        if (!prose.trim() && toolCalls.length === 0) {
            return { text: prose, usage, consumedUserIdx };
        }

        const append = await ctx.fns.session.appendMessage({ id: agent.id, message: {
            role: 'assistant',
            content: prose,
            tool_calls: toolCalls.length ? toolCalls : undefined,
        } });
        await ctx.fns.session.syncAgentState({ agent });

        if (prose.trim()) {
            const html = await ctx.fns.markdown.render({ source: prose });
            await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
                text: prose, html, usage, messageIdx: append.idx,
            } });
            await ctx.fns.session.syncAgentState({ agent });
        }

        if (toolCalls.length === 0) return { text: prose, usage, consumedUserIdx };

        // Every answer row is written NOW, empty, right after the call it
        // belongs to — before a single tool runs. A call with no result is a
        // transcript every provider rejects, and a run can die mid-flight (a
        // restart, a kill, a sleeping machine); with the row already in place
        // the worst case is an honest "interrupted", not an agent that can
        // never speak again because its own history is malformed.
        const pending: Record<string, number> = {};
        for (const call of toolCalls) {
            const row = await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'tool',
                content: `(${call.name} is running — interrupted before it reported back)`,
                tool_call_id: call.id,
                excluded_from_cursor: true,
            } });
            pending[call.id] = row.idx;
        }
        await ctx.fns.session.syncAgentState({ agent });

        // Calls in one reply are independent by construction — no protocol lets
        // a later call read an earlier one's result — so a failure does not
        // invalidate its neighbours. Each is executed and its row filled in.
        for (const call of toolCalls) {
            const r = await ctx.fns.tools.call({ name: call.name, args: call.args, agent });
            const output = await ctx.fns.agent.stashResult({ agent, output: r.output, kind: call.name });

            // Highlight each side in the grammar that actually fits: a write's
            // body in the file's language, a read's result likewise, bash in
            // shell — not everything as JavaScript.
            const argsLang = ctx.fns.agent.toolLang({ name: call.name, args: call.args, part: 'args' });
            const argsCode = argsLang === 'json'
                ? JSON.stringify(call.args ?? {}, null, 2)
                : String(call.args?.code ?? call.args?.command ?? call.args?.content ?? '');
            const argsHtml = await ctx.fns.markdown.highlight({ code: argsCode, lang: argsLang });
            const resultHtml = await ctx.fns.agent.highlightResult({
                output,
                lang: ctx.fns.agent.toolLang({ name: call.name, args: call.args, part: 'result' }),
            });
            await ctx.fns.session.appendToolCallEvent({ id: agent.id, payload: {
                name: call.name, args: call.args, result: output,
                argsHtml, resultHtml, isError: r.isError,
                messageIdx: append.idx,
            } });

            await ctx.fns.session.updateMessageContent({
                id: agent.id,
                idx: pending[call.id]!,
                content: r.content?.length ? [{ type: 'text', text: output }, ...r.content] : output,
            });
        }
        await ctx.fns.session.syncAgentState({ agent });
    }
}
