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
export default async function (
    ctx: Context,
    opts: { agent: types.agent.Agent },
): Promise<{ system: string; messages: any[] }> {
    const { agent } = opts;
    const fullPrompt = await ctx.fns.agent.fullSystemPrompt(ctx, { agent });
    const base = agent.parentId
        ? ctx.fns.session.getFullMessages(ctx, { id: agent.id })
        : (agent.messages ?? []);

    const ep = ctx.fns.llm.resolveEndpoint(ctx, { model: agent.model });
    const claudeCodeHeader = "You are Claude Code, Anthropic's official CLI for Claude.";

    let system = '';
    let bodyText = fullPrompt;
    if (ep.provider === 'claude-code') {
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

    return {
        system,
        messages: [...bootstrap, ...base],
    };
}
