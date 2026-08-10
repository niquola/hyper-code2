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
    const agentCtx: any = Object.create(ctx);
    agentCtx.session = ctx.fns.session.forAgent({ agent });
    ctx = agentCtx;
    const ac = new AbortController();
    agent.abortController = ac;

    if (!opts.userMessageAlreadyAppended) {
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: userText });
        await ctx.fns.session.syncAgentState({ agent });
    }

    // Steering (pi-style): a user message POSTed while this run is busy joins
    // the NEXT model call — the transcript is refreshed before every stream —
    // and `consumedUserIdx` records the frontier that call actually saw, so
    // the worker's finalize won't schedule a duplicate run for a message this
    // run already answered.
    let consumedUserIdx = -1;

    // A model that ping-pongs markers forever is a legal infinite loop — cap the
    // cycles per run; the note tells it to continue in a fresh pass if needed.
    const MAX_TURNS = 60;
    let turns = 0;

    // Corrected-failure collapse (audit stays; LLM view forgets): failed marker
    // attempts wait here per kind until a call of the SAME kind succeeds, then
    // the failed pair is flagged excluded_from_llm. Protocol notes (truncation,
    // misplaced-marker warnings) collapse once the turn that follows them is
    // clean. Near-tail flags are prefix-cache-cheap.
    const pendingFailures: Record<string, number[]> = {};
    let protocolNoteIdxs: number[] = [];
    let repairPairIdxs: number[] = [];
    let repairs = 0;

    while (true) {
        if (++turns > MAX_TURNS) {
            await ctx.fns.session.appendErrorEvent({ id: agent.id, error: `run hit the ${MAX_TURNS}-turn cap — closing; send a message to continue` });
            await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user', content: `§error:turn-cap\nThis run exceeded ${MAX_TURNS} marker cycles and was closed. Summarize where you are; the user can send a message to continue.`, excluded_from_cursor: true,
            } });
            await ctx.fns.session.syncAgentState({ agent });
            return { text: '', usage: null, consumedUserIdx };
        }
        // Order matters (ck's review): read the frontier BEFORE syncing the
        // transcript. A message landing between the two then gets INTO the
        // model call but is NOT counted consumed — worst case a harmless
        // duplicate pass. The reverse order counted messages the model never
        // saw and lost them.
        const seen = ((await ctx.fns.procs.db.select({
            sql: "SELECT COALESCE(MAX(idx), -1) AS i FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
            params: [agent.id],
        })) as any[])[0];
        consumedUserIdx = Math.max(consumedUserIdx, Number(seen?.i ?? -1));
        await ctx.fns.session.syncAgentState({ agent });

        let { text, usage, finishReason } = await ctx.fns.llm.stream({ agent, signal: ac.signal });
        let parsed = ctx.fns.agent.parseMarkers({ text: String(text ?? '') });

        if (finishReason === 'length' && parsed.calls.length > 0) {
            const hint = 'Your reply hit the token limit and was truncated mid-marker. NOTHING was executed. ' +
                'Re-issue the marker(s) in a shorter form: split large §write bodies into several calls, ' +
                'or produce big content via §eval + Bun.write in chunks.';
            await ctx.fns.session.appendErrorEvent({ id: agent.id, error: 'reply truncated at token limit — markers not executed' });
            const tn = await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user', content: `§error:truncated\n${hint}`, excluded_from_cursor: true,
            } });
            protocolNoteIdxs.push(tn.idx);
            await ctx.fns.session.syncAgentState({ agent });
            continue;
        }

        // Repair loop, DB-first (co's design + co's review): a reply with
        // protocol errors or broken marker bodies AND nothing that passes
        // preflight is not accepted. The candidate and a one-error repair note
        // are PERSISTED as ordinary rows — the next stream reads them from the
        // synced transcript (no in-memory agent.messages mutation, no race
        // with steering; a user message landing mid-repair joins the retry
        // naturally). Once a reply is accepted (or repairs are exhausted) the
        // candidate+note rows are flagged excluded_from_llm — near-tail,
        // prefix-cache-cheap — so only the accepted attempt stays in the LLM
        // view. Invalid candidates surface as dimmed `attempt` events.
        const preflights = parsed.calls.map((c: any) => ctx.fns.agent.preflightCall({ call: c }));
        const executableCount = preflights.filter((pf: any) => pf.ok).length;
        const firstHint = parsed.errors[0]?.hint ?? preflights.find((pf: any) => !pf.ok)?.hint;
        if (executableCount === 0 && firstHint && String(text ?? '').trim() && repairs < 2) {
            repairs++;
            const cand = await ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: String(text) } });
            const note = await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user',
                content: `Your previous response was invalid and was NOT executed.\nError: ${firstHint}\nReturn a corrected replacement response only. Do not explain the correction.`,
                excluded_from_cursor: true,
            } });
            repairPairIdxs.push(cand.idx, note.idx);
            await ctx.fns.session.appendEvent({ id: agent.id, event: {
                type: 'attempt', status: 'invalid', repair: repairs, text: String(text), error: firstHint, messageIdx: cand.idx,
            } });
            await ctx.fns.session.syncAgentState({ agent });
            continue;
        }
        // Leaving repair mode (accepted, or fell back to permissive): the
        // intermediate candidates and notes drop out of the LLM view.
        if (repairPairIdxs.length) {
            await ctx.fns.session.collapseFailures({ id: agent.id, messageIdxs: repairPairIdxs });
            repairPairIdxs = [];
            repairs = 0;
            await ctx.fns.session.syncAgentState({ agent });
        }

        const { prose, calls, errors, epilogue } = parsed;

        // A reply cut off by the token limit may end mid-marker — a §write with
        // half a file, an §eval with half a statement. Executing that corrupts
        // state, so NOTHING runs: the model is told to re-issue, smaller.


        // No markers and no parser errors — close the turn cleanly.
        if (calls.length === 0 && errors.length === 0) {
            // Skip empty completions entirely — they produce phantom bubbles
            // and have no informational value to either UI or LLM.
            if (!text || !String(text).trim()) {
                return { text: text ?? '', usage, consumedUserIdx };
            }
            if (protocolNoteIdxs.length) {
                await ctx.fns.session.collapseFailures({ id: agent.id, messageIdxs: protocolNoteIdxs });
                protocolNoteIdxs = [];
            }
            const append = await ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: text } });
            await ctx.fns.session.syncAgentState({ agent });
            const html = await ctx.fns.markdown.render({ source: prose || text || '' });
            await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
                text: prose || text || '', html, usage, messageIdx: append.idx,
            } });
            await ctx.fns.session.syncAgentState({ agent });
            return { text, usage, consumedUserIdx };
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

        // Fail-fast chain: markers after a failed one were written assuming its
        // success (verify → patch → write) — executing them anyway applies
        // patches whose precondition just failed. Skip the rest, say so.
        let failedAt: string | null = null;
        for (const call of calls) {
            if (failedAt) {
                const sk = await ctx.fns.session.appendMessage({ id: agent.id, message: {
                    role: 'user',
                    content: `§result:${call.kind}:skipped\nskipped: earlier §${failedAt} in this reply failed — re-issue this marker if it still applies.`,
                    excluded_from_cursor: true,
                } });
                (pendingFailures[call.kind] ??= []).push(sk.idx);
                continue;
            }
            const r = await ctx.fns.agent.executeMarker({ agent, call, usage });
            if ((r as any)?.isError) {
                failedAt = call.kind;
                (pendingFailures[call.kind] ??= []).push(...[(r as any).markerIdx, (r as any).resultIdx].filter((n: any) => n != null));
            } else {
                const fixed = [...(pendingFailures[call.kind] ?? []), ...(protocolNoteIdxs.length ? protocolNoteIdxs : [])];
                if (fixed.length) {
                    await ctx.fns.session.collapseFailures({ id: agent.id, messageIdxs: fixed });
                    delete pendingFailures[call.kind];
                    protocolNoteIdxs = [];
                }
            }
        }
        if (failedAt) await ctx.fns.session.syncAgentState({ agent });

        // Prose the model wrote AFTER an explicitly-closed body (bare § line) —
        // rendered in order, after the calls it follows.
        if (epilogue?.trim()) {
            const epAppend = await ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: epilogue } });
            await ctx.fns.session.syncAgentState({ agent });
            const epHtml = await ctx.fns.markdown.render({ source: epilogue });
            await ctx.fns.session.appendAssistantEvent({ id: agent.id, payload: {
                text: epilogue, html: epHtml, usage, messageIdx: epAppend.idx,
            } });
            await ctx.fns.session.syncAgentState({ agent });
        }

        // Parser errors (misplaced markers etc) tail the chain as a single
        // user message so the model can self-correct on the next turn.
        if (errors.length > 0) {
            for (const e of errors) {
                await ctx.fns.session.appendErrorEvent({ id: agent.id, error: e.hint });
            }
            const errText = errors.map(e => ctx.fns.agent.formatMarkerError({ error: e })).join('\n\n');
            const wn = await ctx.fns.session.appendMessage({ id: agent.id, message: {
                role: 'user', content: errText, excluded_from_cursor: true,
            } });
            protocolNoteIdxs.push(wn.idx);
            await ctx.fns.session.syncAgentState({ agent });
        }
    }
}
