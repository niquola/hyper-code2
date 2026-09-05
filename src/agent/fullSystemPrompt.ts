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

/** Full system prompt for the runtime.  * @param opts.agent Agent whose state is read or updated.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Live agent instance to operate on. */
agent: types.agent.Agent }): Promise<string> {
    const { agent } = opts;
    const core = await Bun.file(CORE_PATH).text();
    const tools = ctx.fns.tools.promptSection({ protocol: "json", only: agent.tools });
    // Executable plugins are ordinary procs functions, not necessarily native
    // tools. Advertise only a compact index plus the public discovery API; the
    // agent reads SKILL.md on demand instead of paying for every plugin's docs
    // in every request.
    const plugins = ctx.fns.plugins.list({}) as any[];
    const pluginBlock = plugins.length
        ? `\n\n## Mounted plugins\n\nPlugin layers: core runtime is built into Hyper; official plugins ship in the Hyper repository; user plugins live as direct children of the external \`USER_PLUGINS\` directory and are writable by the user/agent. Create substantial private integrations in \`USER_PLUGINS\`, not in the official \`plugins/\` tree; use \`.hyper/\` only for small project-local procedures.\n\n${plugins.map((p: any) => `- ${p.name} [${p.source}]: ${p.description || p.namespaces.join(", ")}`).join("\n")}\n\nPlugin workflow (ordinary functions, call through eval):\n1. Translate the user's capability intent into a concise English search query, regardless of the user's language.\n2. await ctx.fns.plugins.search({ query }) — search both plugin workflows (SKILL.md) and live function documentation. Do this before guessing a plugin or function name.\n3. await ctx.fns.plugins.read({ name }) — read the selected plugin's human-written workflow overview plus generated function docs, schemas and return types.\n4. Call the selected function through ctx.fns.<namespace>.<function>({ ... }).\nUse ctx.fns.plugins.functions({ name }) only for a compact generated catalogue. Manage plugins with plugins.load/add/remove/reload. Do not assume every plugin function is a native tool.`
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
        // Deliberately no literal id: a transcript-sharing fork must send the
        // byte-identical prefix as its parent, or the provider prompt cache misses.
        "- your agent id: `agent.id` inside eval, or `await ctx.fns.agent.current({})` from any runtime function (never hard-code it)",
        "- storage: Postgres — ctx.fns.procs.db.* (never bare Bun.sql)",
        "",
        "- durable wake-ups: await ctx.fns.agent.wakeIn({ id: agent.id, delayMs, reason }) or wakeAt({ id: agent.id, at, reason }); cancelWake({ id: agent.id })",
        "- conditional wake: wakeUpWhen({ id: agent.id, predicate: 'file.exists'|'db.rows'|'http.ok'|'runtime.fn', opts, reason, everyMs?, timeoutMs? }); runtime.fn opts: { name: 'module.function', args, callTimeoutMs? }; default polling is 5m",
        "- for reusable project-local procedures, prefer .hyper/<module>/<fn>.ts runtime functions; do not pass arbitrary code to durable watches",
    ].join("\n");

    return core + "\n\n" + tools + pluginBlock + perAgentBlock + runtime;
}
