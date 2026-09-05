/**
 * Enables or disables entity extraction sidecars for one agent
 *
 * Persists the per-agent Track entities flag in the durable scratchpad (`knowledgeTrackingEnabled`) and refreshes the Knowledge meta section. Use to opt individual chats into or out of `knowledge.updateSidecar` runs after successfully completed agent turns without changing execution behavior.
 * @param opts.id Agent identifier whose flag is changed.
 * @param opts.enabled Whether successful agent turns should launch the extraction sidecar.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Agent identifier whose flag is changed. */ id: string;
    /** Whether successful agent turns should launch the extraction sidecar. */ enabled: boolean;
}): Promise<{ enabled: boolean }> {
    const agent = (ctx.state as any).agent?.[opts.id] ?? await ctx.fns.session.load({ id: opts.id });
    if (!agent) throw new Error(`agent not found: ${opts.id}`);
    const updated: any = await ctx.fns.session.mutateScratchpad({ id: opts.id, mutate: (scratchpad: Record<string, any>) => {
        scratchpad.knowledgeTrackingEnabled = opts.enabled === true;
        return { enabled: scratchpad.knowledgeTrackingEnabled === true };
    } });
    agent.scratchpad = { ...(agent.scratchpad ?? {}), knowledgeTrackingEnabled: updated.scratchpad.knowledgeTrackingEnabled };
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, section: "knowledge" as any, reason: "knowledge-tracking" });
    return updated.result as { enabled: boolean };
}
