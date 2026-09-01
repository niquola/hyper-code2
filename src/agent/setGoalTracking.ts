/**
 * Enables or disables display-only goal observation for one agent
 *
 * Persists the per-agent Track goals flag in the durable scratchpad and refreshes the Observed goals meta section. Use to opt individual chats into or out of goal sidecar extraction without changing execution behavior.
 * @param opts.id Agent identifier whose goal observation flag is changed.
 * @param opts.enabled Whether new text messages should launch the display-only goal sidecar.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Agent identifier whose goal observation flag is changed. */
        id: string;
        /** Whether new text messages should launch the display-only goal sidecar. */
        enabled: boolean;
    },
): Promise<{ enabled: boolean }> {
    const agent = (ctx.state as any).agent?.[opts.id] ?? await ctx.fns.session.load({ id: opts.id });
    if (!agent) throw new Error(`agent not found: ${opts.id}`);
    const updated: any = await ctx.fns.session.mutateScratchpad({ id: opts.id, mutate: (scratchpad: Record<string, any>) => {
      scratchpad.goalTrackingEnabled = opts.enabled === true;
      return { enabled: scratchpad.goalTrackingEnabled === true };
    } });
    agent.scratchpad = updated.scratchpad;
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, section: "goal", reason: "goal-tracking" });
    return updated.result as { enabled: boolean };
}
