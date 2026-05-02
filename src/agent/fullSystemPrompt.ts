// Build the complete system prompt sent to the LLM each turn:
//   1. SYSTEM_PROMPT_CORE.md   — wire-format-agnostic project knowledge
//   2. SYSTEM_PROMPT.md        — markers wire-format
//   3. agent.systemPrompt      — per-agent additive override (if any)
//   4. project instructions    — CLAUDE.md or AGENTS.md from cwd if present
//   5. runtime context block   — cwd, agent id, db path
import { resolve } from "node:path";

const CORE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT_CORE.md");
const WIRE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT.md");

export default async function (ctx: Context, agent: types.agent.Agent): Promise<string> {
    const core = await Bun.file(CORE_PATH).text();
    const wire = await Bun.file(WIRE_PATH).text();

    // Per-agent additive override. Empty by default — the markers wire layer
    // and CORE come from the prepended files. Only non-empty when the user
    // typed something into the new-agent form.
    const perAgent = (agent.systemPrompt ?? "").trim();
    const perAgentBlock = perAgent ? `\n\n## Per-agent instructions\n\n${perAgent}` : "";

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
        `- db path: ${ctx.env?.DB_PATH ?? ".hyper/_runtime/sessions"}`,
        "",
    ].join("\n");

    return core + "\n\n" + wire + perAgentBlock + projectInstructions + runtime;
}
