/**
 * Resolves and enforces the calling sidebar agent’s durable browser target binding.
 *
 * Use before browser session selection or target discovery. Unbound calls retain ordinary named-session behavior. Closed or revoked bindings and mismatched explicit sessions or targets fail closed. This API guard is not a sandbox against unrestricted code execution.
 * @param opts.session Explicit logical session; must match the binding for a sidebar agent.
 * @param opts.targetId Explicit Chrome target; must match the binding for a sidebar agent.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Explicit logical session; must match the binding for a sidebar agent. */
        session?: string;
        /** Explicit Chrome target; must match the binding for a sidebar agent. */
        targetId?: string;
    },
): Promise<{ session?: string; targetId?: string; bound: boolean }> {
    const agentId = session?.agent?.id ?? session?.agentId;
    const lookup = (ctx.fns as any).sidebar?.bindingForAgent;
    if (!agentId || typeof lookup !== "function") return { session: opts.session, targetId: opts.targetId, bound: false };
    const binding = await lookup({ agentId });
    if (!binding) return { session: opts.session, targetId: opts.targetId, bound: false };
    if (binding.state !== "active") throw new Error("Browser binding is " + binding.state + "; browser access is unavailable");
    if (opts.session !== undefined && opts.session !== binding.cdpSessionName) throw new Error("Browser session does not match this agent's bound tab");
    if (opts.targetId !== undefined && opts.targetId !== binding.targetId) throw new Error("Browser target does not match this agent's bound tab");
    return { session: binding.cdpSessionName, targetId: binding.targetId, bound: true };
}
