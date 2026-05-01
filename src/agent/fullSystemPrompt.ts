// Build the complete system prompt sent to the LLM each turn:
//   1. SYSTEM_PROMPT_CORE.md            — wire-format-agnostic project knowledge
//   2. SYSTEM_PROMPT.md or SYSTEM_PROMPT_MARKERS.md — wire-format layer for the active protocol
//   3. agent.systemPrompt               — per-agent override/addition (if non-empty and not the default)
//   4. project instructions             — CLAUDE.md or AGENTS.md from cwd if present
//   5. runtime context block            — cwd, agent id, db path
//
// Protocol selection mirrors run.ts: agent.scratchpad.protocol → settings(agent.protocol) → 'tool-calls'.
import { resolve } from "node:path";

const CORE_PATH      = resolve(import.meta.dir, "SYSTEM_PROMPT_CORE.md");
const TOOLCALLS_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT.md");
const MARKERS_PATH   = resolve(import.meta.dir, "SYSTEM_PROMPT_MARKERS.md");

export default async function (ctx: Context, agent: types.agent.Agent): Promise<string> {
    const protocol = (agent.scratchpad as any)?.protocol
        ?? ctx.fns.settings?.getString?.(ctx, { module: 'agent', scopeType: 'global', key: 'protocol' })
        ?? 'tool-calls';

    const core = await Bun.file(CORE_PATH).text();
    const protocolPath = protocol === 'markers' ? MARKERS_PATH : TOOLCALLS_PATH;
    const protocolPrompt = await Bun.file(protocolPath).text();

    // agent.systemPrompt is treated as an additive per-agent override. Old agents
    // saved before the split may still have the legacy 706-line prompt cached
    // there — in that case skip it (heuristic: starts with the legacy first line).
    const perAgent = (agent.systemPrompt ?? "").trim();
    const isLegacy = perAgent.startsWith("You are an agent with exactly ONE tool: `evalCode`")
                  || perAgent.startsWith("# Wire format: tool-calls protocol");
    const perAgentBlock = (perAgent && !isLegacy)
        ? `\n\n## Per-agent instructions\n\n${perAgent}`
        : "";

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
        `- protocol: ${protocol}`,
        "",
    ].join("\n");

    return core + "\n\n" + protocolPrompt + perAgentBlock + projectInstructions + runtime;
}