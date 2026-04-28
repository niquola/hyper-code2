// Build the complete system prompt sent to the LLM each turn:
// agent.systemPrompt + an auto-injected "Runtime context" block with cwd,
// agent id and db path. Used by every streamer (openai, anthropic, codex)
// so the runtime block stays in one place.
export default function (ctx: Context, agent: types.agent.Agent): string {
    const runtime = [
        "",
        "## Runtime context (auto-injected, fresh each turn)",
        `- cwd: ${process.cwd()}`,
        `- your agent id: ${agent.id}`,
        `- db path: ${ctx.env.DB_PATH ?? ".hyper/sessions"}`,
        "",
        "Inside `evalCode` you also have direct access: `agent.id`, `process.cwd()`.",
    ].join("\n");
    return (agent.systemPrompt ?? "") + runtime;
}
