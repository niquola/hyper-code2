// Build the system prompt sent to the LLM each turn. Kept intentionally small —
// long prompts hit the "lost in the middle" attention failure on every frontier
// model. Detail docs (CLAUDE.md, docs/architecture.md, the source itself) are
// referenced from CORE and read on demand via the read tool.
//
// Layers:
//   1. SYSTEM_PROMPT_CORE.txt — invariants + map of ctx.fns + doc pointers
//   2. the tool section       — ASSEMBLED from the $tool_ declarations that are
//                               actually loaded (index + guidelines), so an
//                               unmounted or narrowed-away tool costs no tokens
//   3. agent.systemPrompt     — per-agent additive override (if any)
//   4. runtime context block  — workspace, agent id, storage
//
// There is no wire-format section any more: tools travel as native function
// schemas in the request's `tools` array, so describing a call syntax in prose
// would be duplicating what the provider already enforces.
import { resolve } from "node:path";

const CORE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT_CORE.txt");

export default async function (ctx: Context, _session: Session | null, opts: { agent: types.agent.Agent }): Promise<string> {
    const { agent } = opts;
    const core = await Bun.file(CORE_PATH).text();
    const tools = ctx.fns.tools.promptSection({ protocol: "json", only: agent.tools });
    // Executable plugins are ordinary procs functions, not necessarily native
    // tools. Advertise only a compact index plus the public discovery API; the
    // agent reads SKILL.md on demand instead of paying for every plugin's docs
    // in every request.
    const plugins = ctx.fns.plugins.list({}) as any[];
    const pluginBlock = plugins.length
        ? `\n\n## Mounted plugins\n\n${plugins.map((p: any) => `- ${p.name}: ${p.description || p.namespaces.join(", ")}`).join("\n")}\n\nPlugin workflow (ordinary functions, call through eval):\n1. ctx.fns.plugins.list({}) — compact mounted catalogue.\n2. await ctx.fns.plugins.read({ name }) — metadata + SKILL.md text; read this before using a plugin.\n3. ctx.fns.plugins.functions({ name }) — dotted function names and live signatures.\n4. Call the selected function through ctx.fns.<namespace>.<function>({ ... }).\nManage plugins with plugins.load/add/remove/reload. Do not assume every plugin function is a native tool.`
        : "";

    const perAgent = (agent.systemPrompt ?? "").trim();
    const perAgentBlock = perAgent ? `\n\n## Per-agent instructions\n\n${perAgent}` : "";

    const runtime = [
        "",
        "## Runtime context (auto-injected, fresh each turn)",
        `- workspace directory: ${agent.workspaceDir || process.cwd()}`,
        "- read/write/grep/edit, ctx.fns.files.* , bash and ctx.fns.git.* resolve here",
        "- CAVEAT: raw Bun.file()/Bun.write() inside eval resolve against the SERVER's cwd,",
        "  not the workspace — inside eval use ctx.fns.files.* or ctx.fns.workspace.resolve({ path })",
        "- inspect/change: ctx.fns.workspace.get({}) / await ctx.fns.workspace.set({ dir })",
        "- workspace is a base directory, not a sandbox",
        `- your agent id: ${agent.id}`,
        "- storage: Postgres — ctx.fns.procs.db.* (never bare Bun.sql)",
        "",
    ].join("\n");

    return core + "\n\n" + tools + pluginBlock + perAgentBlock + runtime;
}
