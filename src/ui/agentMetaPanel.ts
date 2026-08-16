// The right inspector panel is a STATIC shell with five slots. Sections are
// rendered by ui.agentMetaSection and placed into id-addressable slots; a
// pushed ui.metaSection event then makes the client re-fetch exactly one
// section through ui.agentMetaSectionHtml and swap it in place — the shell,
// the scroll position and the other sections never move.
//
// This used to be one live region around the whole <aside>: every plan tick
// re-rendered everything, and every <details> lost its "open" state, so the
// panel collapsed under the user's hands while an agent was working.
/** Renders the agent inspector panel shell with its five sections. */
/**
 * Render the metadata panel for an agent.
 *
 * The returned <aside> carries no live behavior of its own. Each section slot
 * is a div with id "agent-meta-<section>-<agentId>"; the client redraws one
 * slot at a time when the server pushes ui.metaSection for it.
 *
 * @param opts.agent Agent associated with the operation.
 * @param opts.team Direct delegated children with their existing plans.
 * @param opts.archivedTeam Archived delegated children displayed by the Team filter.
 * @param opts.models Models grouped by provider, used by the parked-agent switcher.
 * @param opts.accounts Credential accounts with their quota, used by the parked-agent switcher.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    /** Agent associated with the operation. */ agent: types.agent.Agent;
    /** Direct delegated children with their existing plans. */ team?: Array<{ id: string; title: string; runState: string; status: string; plan: any; summary: string | null; updatedAt: number; archivedAt?: number | null }>;
    /** Archived delegated children displayed by the Team filter. */ archivedTeam?: Array<{ id: string; title: string; runState: string; status: string; plan: any; summary: string | null; updatedAt: number; archivedAt?: number | null }>;
    /** Models grouped by provider, used by the parked-agent switcher. */ models?: Record<string, string[]>;
    /** Credential accounts with their quota, used by the parked-agent switcher. */ accounts?: Array<{ provider: string; account: string; label: string; model: string; available: boolean; usedPercent: number | null; resetsAt: number | null; parkedAgents: number }> }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agent = opts.agent;
    const slot = (section: "goal" | "automation" | "wake" | "team" | "plan") =>
        `<div id="agent-meta-${section}-${esc(agent.id)}" data-meta-section="${section}">`
        + ctx.fns.ui.agentMetaSection({ agent, section, team: opts.team, archivedTeam: opts.archivedTeam, models: opts.models, accounts: opts.accounts })
        + `</div>`;
    return `<aside id="agent-meta-${esc(agent.id)}" class="glass-panel flex h-full w-80 shrink-0 flex-col border-l border-ui-border text-base-content">
      <header class="glass-bar flex h-8 shrink-0 items-center gap-2 border-b border-ui-border px-3">
        <i class="ph ph-sidebar-simple text-sm text-base-content/45" aria-hidden="true"></i><span class="min-w-0 flex-1 truncate text-xs font-semibold text-base-content">Agent inspector</span><span class="font-mono text-[10px] text-base-content/40">${esc(agent.id)}</span>
      </header>
      <div class="flex-1 overflow-y-auto bg-base-200">
        ${slot("goal")}
        ${slot("automation")}
        ${slot("wake")}
        ${slot("team")}
        ${slot("plan")}
      </div>
    </aside>`;
}
