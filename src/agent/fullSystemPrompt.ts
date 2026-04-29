// Build the complete system prompt sent to the LLM each turn:
//   1. agent.systemPrompt (per-agent, usually SYSTEM_PROMPT.md)
//   2. project instructions — CLAUDE.md or AGENTS.md from cwd if present
//   3. an auto-injected "Runtime context" block (cwd, agent id, db path)
// All three streamers (openai, anthropic, codex) call this so the layout
// stays in one place.
export default async function (ctx: Context, agent: types.agent.Agent): Promise<string> {
    const projectFile = await Bun.file("CLAUDE.md").exists()
        ? "CLAUDE.md"
        : await Bun.file("AGENTS.md").exists() ? "AGENTS.md" : null;
    const projectInstructions = projectFile
        ? `\n\n## Project instructions (${projectFile})\n\n${await Bun.file(projectFile).text()}`
        : "";

    const runtime = [
        "",
        "## Runtime context (auto-injected, fresh each turn)",
        `- cwd: ${process.cwd()}`,
        `- your agent id: ${agent.id}`,
        `- db path: ${ctx.env.DB_PATH ?? ".hyper/sessions"}`,
        "",
        "Inside `evalCode` you also have direct access: `agent.id`, `process.cwd()`.",
    ].join("\n");

    return (agent.systemPrompt ?? "") + projectInstructions + runtime;
}
