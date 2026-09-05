/**
 * Stores the display-only observed goal list produced by a goal sidecar fork on its parent agent
 *
 * Called from inside a hidden goal sidecar fork (via eval) to hand the reconciled goal list back to the parent chat. The parent is always the calling fork's own parent (scratchpad.goalSidecarFor must match); normalizes and caps each goal, writes scratchpad.goalSidecar on the parent guarded against stale or duplicate writers, and refreshes the parent's Goal meta section. Never changes agent.goal, scheduling, plans or the parent transcript. Use exactly once, as the sidecar's final answer.
 * @param opts.goals Full reconciled goal list replacing the previous preview; at most 20 entries are kept.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Full reconciled goal list replacing the previous preview; at most 20 entries are kept. */
        goals: Array<{ id?: string; statement: string; verification?: string; status?: 'candidate' | 'active' | 'completed' | 'abandoned'; sourceMessageIdx?: number }>;
    },
): Promise<{ parentId: string; goals: Array<{ id: string; statement: string; verification: string; status: 'candidate' | 'active' | 'completed' | 'abandoned'; sourceMessageIdx: number }> }> {
    const me: any = session?.agent ?? (session?.agentId ? (ctx.state as any).agent?.[session.agentId] : null);
        const parentId = String(me?.parentId ?? "").trim();
        if (!me?.id || !parentId || me.scratchpad?.goalSidecarFor !== parentId) throw new Error("agent.setObservedGoals: only a goal sidecar fork may report goals to its own parent");
        const parent: any = (ctx.state as any).agent?.[parentId] ?? await ctx.fns.session.load({ id: parentId });
        if (!parent) throw new Error(`agent.setObservedGoals: parent not found: ${parentId}`);
        const sourceMessageIdx = Math.max(0, Math.floor(Number(me?.scratchpad?.sourceMessageIdx ?? parent.scratchpad?.goalSidecar?.sourceMessageIdx ?? 0) || 0));
        const previous: any[] = Array.isArray(parent.scratchpad?.goalSidecar?.goals) ? parent.scratchpad.goalSidecar.goals : [];
        const allowed = new Set(["candidate", "active", "completed", "abandoned"]);
        const goals = (Array.isArray(opts.goals) ? opts.goals : []).slice(0, 20).map((goal: any, index: number) => ({
            id: String(goal?.id || previous[index]?.id || `g${index + 1}`).slice(0, 80),
            statement: String(goal?.statement ?? "").trim().slice(0, 1000),
            verification: String(goal?.verification ?? previous[index]?.verification ?? "").trim().slice(0, 1000),
            status: (allowed.has(String(goal?.status)) ? String(goal.status) : "candidate") as "candidate" | "active" | "completed" | "abandoned",
            sourceMessageIdx: Math.max(0, Math.floor(Number(goal?.sourceMessageIdx ?? sourceMessageIdx) || sourceMessageIdx)),
        })).filter((goal: any) => goal.statement);
        const updated = await ctx.fns.session.mutateScratchpad({ id: parentId, mutate: (scratchpad: Record<string, any>, now: number) => {
            const current = scratchpad.goalSidecar ?? {};
            // Stale (older message) or foreign (another sidecar already answered
            // for this very message) writers are ignored; a repeated call from
            // the same sidecar simply replaces its own answer.
            if (Number(current.sourceMessageIdx ?? -1) > sourceMessageIdx) return { ignored: "stale" };
            if (Number(current.sourceMessageIdx ?? -1) === sourceMessageIdx && current.sidecarId && current.sidecarId !== me.id && current.status === "ready") return { ignored: "duplicate" };
            scratchpad.goalSidecar = { goals, status: "ready", updatedAt: now, sourceMessageIdx, sidecarId: me.id };
            return { ignored: null };
        } });
        // Only the goalSidecar key is ours; a live parent run keeps transient
        // keys (activeStatusLine, mobileStream, ...) in memory that the DB copy
        // does not have, so never replace the whole object.
        parent.scratchpad = { ...(parent.scratchpad ?? {}), goalSidecar: updated.scratchpad.goalSidecar };
        if ((updated.result as any)?.ignored) return { parentId, goals: Array.isArray(parent.scratchpad.goalSidecar?.goals) ? parent.scratchpad.goalSidecar.goals : goals };
        ctx.fns.events.refreshAgentMeta({ agentId: parentId, section: "goal", reason: "goal-sidecar" });
        return { parentId, goals };
}
