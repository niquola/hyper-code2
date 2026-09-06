/**
 * Enables or disables entity extraction sidecars for one agent
 *
 * Persists the per-agent Track entities flag in the durable scratchpad (`knowledgeTrackingEnabled`) and refreshes the Knowledge meta section. Use to opt individual chats into or out of `knowledge.updateSidecar` runs after successfully completed agent turns without changing execution behavior.
 * Enabling starts observation from now: the applied checkpoint is set to the last persisted message so long histories are not replayed (a replay would exceed the extraction window and fail on every turn). Pass `fromStart: true` to keep an existing checkpoint or extract the whole history.
 * @param opts.id Agent identifier whose flag is changed.
 * @param opts.enabled Whether successful agent turns should launch the extraction sidecar.
 * @param opts.fromStart Keep the existing checkpoint (or start from the beginning) instead of skipping past history. @default false
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Agent identifier whose flag is changed. */ id: string;
    /** Whether successful agent turns should launch the extraction sidecar. */ enabled: boolean;
    /** Keep the existing checkpoint (or extract the whole history) instead of starting from the current end of the chat. @default false */ fromStart?: boolean;
}): Promise<{ enabled: boolean; appliedSourceMessageIdx?: number }> {
    const agent = (ctx.state as any).agent?.[opts.id] ?? await ctx.fns.session.load({ id: opts.id });
    if (!agent) throw new Error(`agent not found: ${opts.id}`);
    const tail = opts.enabled && !opts.fromStart ? Number((await ctx.fns.procs.db.select({ sql: "SELECT COALESCE(MAX(idx), -1) AS idx FROM messages WHERE agent_id = ?", params: [opts.id] }))[0]?.idx ?? -1) : null;
    const updated: any = await ctx.fns.session.mutateScratchpad({ id: opts.id, mutate: (scratchpad: Record<string, any>) => {
        scratchpad.knowledgeTrackingEnabled = opts.enabled === true;
        if (tail != null) {
            const current = scratchpad.knowledgeSidecar ?? {};
            const applied = Number(current.appliedSourceMessageIdx ?? current.lastSuccessfulMessageIdx ?? -1);
            if (applied < tail) scratchpad.knowledgeSidecar = { ...current, status: current.status === "error" ? "ready" : current.status, error: undefined, appliedSourceMessageIdx: tail, lastSuccessfulMessageIdx: tail, sourceMessageIdx: tail, updatedAt: Date.now() };
        }
        return { enabled: scratchpad.knowledgeTrackingEnabled === true, appliedSourceMessageIdx: scratchpad.knowledgeSidecar?.appliedSourceMessageIdx };
    } });
    agent.scratchpad = { ...(agent.scratchpad ?? {}), knowledgeTrackingEnabled: updated.scratchpad.knowledgeTrackingEnabled, knowledgeSidecar: updated.scratchpad.knowledgeSidecar };
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, section: "knowledge" as any, reason: "knowledge-tracking" });
    return updated.result as { enabled: boolean; appliedSourceMessageIdx?: number };
}
