// Build the system + messages payload for an LLM call.
//
// Policy (option A — "system-as-messages"): the full instruction body lives
// as a synthetic user → assistant exchange at the start of the conversation;
// system is empty or near-empty. Rationale: models attend to recent user
// messages more reliably than to system, especially smaller / local models
// (Haiku, Llama). Moving instructions into the conversation also makes them
// visible in transcript debugging.
//
// Anthropic OAuth subscription (claude-code provider) is a special case:
// the server-side anti-fraud check rejects requests whose system prompt
// doesn't start with the Claude Code identity line. That line MUST stay in
// `system` regardless of policy. Everything else moves to messages.
//
// Returns:
//   { system: string, messages: Message[] }  — both ready to feed to a
//   streamer. messages is [bootstrap-user, bootstrap-ack, ...transcript].
/** Build llm request for the runtime.  * @param opts.agent Agent whose state is read or updated.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Live agent instance to operate on. */
    agent: types.agent.Agent },
): Promise<{ system: string; messages: any[] }> {
    const { agent } = opts;
    const fullPrompt = await ctx.fns.agent.fullSystemPrompt({ agent });
    const statusLine = String(agent.scratchpad?.activeStatusLine ?? "").trim();
    const statusBlock = statusLine ? `\n\n## Current status line\n\n${statusLine}` : "";
    const fullHistory = agent.parentId
        ? await ctx.fns.session.getFullMessages({ id: agent.id })
        : (agent.messages ?? []);
    const sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: agent.sleepContext });
    const generation = sleep?.mode === "compact"
        ? ctx.fns.agent.getSleepGeneration({ sleepContext: sleep, kind: "active" })
        : null;
    const sleepMessages = generation?.contextAgentId
        ? await ctx.fns.session.getMessages({ id: String(generation.contextAgentId) })
        : generation?.contextMessages;
    const raw = generation && sleepMessages?.length && Number(generation.sourceOffset) <= fullHistory.length
        ? [...sleepMessages, ...fullHistory.slice(Math.max(0, Number(generation.tailStart ?? generation.sourceOffset)))]
        : fullHistory;

    // A call with no result is a transcript every provider refuses, and a run
    // that dies between the two writes leaves one behind. Repairing here — on
    // the way OUT, for whichever dialect — means such an agent answers again
    // instead of 400-ing forever on history it cannot edit.
    const { messages: base, repaired } = ctx.fns.session.repairToolPairs({ messages: raw });
    const functionRag = await ctx.fns.agent.functionRag({ agent, messages: base }).catch((error: any) => {
        ctx.fns.procs.log.warn({ event: "agent.function-rag.failed", msg: String(error?.message ?? error), agentId: agent.id });
        return null;
    });
    if (functionRag) {
        const at = [...base].map((message: any, index: number) => ({ message, index })).reverse()
            .find(({ message }) => message?.role === "user" && typeof message.content === "string")?.index;
        if (at != null) {
            const message = base[at];
            const block = functionRag.functions.map((fn: any) => `- #${fn.rank} ${fn.name} [RRF ${formatRagScore(fn.score)}${fn.bm25 == null ? "" : ` · BM25 ${formatRagScore(fn.bm25)}`}${fn.similarity == null ? "" : ` · cos ${formatRagScore(fn.similarity)}`}]: ${fn.summary}\n  ${fn.signature}`).join("\n");
            const injected = `<relevant_runtime_functions>\n${block}\n</relevant_runtime_functions>\nUse these only if relevant; inspect one with runtime.docs.get before calling when details are needed.`;
            base[at] = { ...message, content: `${message.content}\n\n${injected}` };
            agent.scratchpad ??= {};
            agent.scratchpad.functionRag = { messageIdx: functionRag.messageIdx, functions: functionRag.functions.map((fn: any) => fn.name), updatedAt: Date.now() };
            queueMicrotask(() => ctx.fns.agent.markFunctionRag({ agent, messageIdx: functionRag.messageIdx, functions: functionRag.functions, injected }).catch(() => undefined));
        }
    }
    if (repaired.length) {
        ctx.fns.procs.log.warn({
            event: "transcript.repair",
            msg: `${agent.id}: closed ${repaired.length} unanswered tool call(s)`,
            calls: repaired.map(r => `${r.name}#${r.id}`),
        });
    }

    const ep = await ctx.fns.llm.resolveEndpoint({ model: agent.model });
    const claudeCodeHeader = "You are Claude Code, Anthropic's official CLI for Claude.";

    let system = '';
    let bodyText = fullPrompt + statusBlock;
    if (ep.provider === 'claude-code' || ep.provider === 'anthropic-oauth') {
        system = claudeCodeHeader;
        if (bodyText.startsWith(claudeCodeHeader)) {
            bodyText = bodyText.slice(claudeCodeHeader.length).trimStart();
        }
    }

    const bootstrap = bodyText
        ? [
            { role: 'user' as const, content: bodyText },
            { role: 'assistant' as const, content: 'Understood. Ready to act.' },
        ]
        : [];

    const messages = [...bootstrap, ...base];

    // A transcript that ENDS with an assistant message is a "prefill" request:
    // the model is asked to continue its own half-written turn. It happens
    // normally here — a run answers a mid-run user message with a terminal
    // respondHtml, the worker reschedules for that same message, and the next
    // request replays a history whose last row is that final answer.
    //
    // Most models continue happily; some (claude-opus-5) reject the request
    // outright with 400 "does not support assistant message prefill", which
    // kills the run, leaves the cursor unadvanced and repeats forever. So the
    // request always ends on a user turn — a one-line nudge, never persisted.
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && !(last.tool_calls?.length)) {
        messages.push({
            role: 'user',
            content: 'Continue from where you stopped: if the previous answer already settled the user\'s request, say so briefly; otherwise take the next step.',
        });
    }

    return {
        system,
        messages,
    };
}


function formatRagScore(value: any): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return Math.abs(n) < 0.1 ? n.toFixed(5) : n.toFixed(3);
}
