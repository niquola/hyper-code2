// Build the system prompt sent to the LLM each turn. Kept intentionally small —
// long prompts hit the "lost in the middle" attention failure on every frontier
// model. Detail docs (CLAUDE.md, docs/architecture.md, the source itself) are
// referenced from CORE and read on demand via ctx.fns.files.read.
//
// Layers:
//   1. SYSTEM_PROMPT_CORE.md  — invariants + map of ctx.fns + doc pointers
//   2. SYSTEM_PROMPT.md       — markers wire-format
//   3. agent.systemPrompt     — per-agent additive override (if any)
//   4. runtime context block  — cwd, agent id, db path
import { resolve } from "node:path";

const CORE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT_CORE.md");
const WIRE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT.md");

export default async function (ctx: Context, agent: types.agent.Agent): Promise<string> {
    const core = await Bun.file(CORE_PATH).text();
    const wire = await Bun.file(WIRE_PATH).text();

    const perAgent = (agent.systemPrompt ?? "").trim();
    const perAgentBlock = perAgent ? `\n\n## Per-agent instructions\n\n${perAgent}` : "";

    const runtime = [
        "",
        "## Runtime context (auto-injected, fresh each turn)",
        `- cwd: ${process.cwd()}`,
        `- your agent id: ${agent.id}`,
        `- db path: ${ctx.env?.DB_PATH ?? ".hyper/_runtime/sessions"}`,
        "",
    ].join("\n");

    return core + "\n\n" + wire + perAgentBlock + runtime;
}
