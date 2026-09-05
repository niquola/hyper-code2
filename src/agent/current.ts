/**
 * Returns the identity of the agent running the current call
 *
 * Reads the calling agent from the injected session (session.agent or session.agentId) and returns its id, model, title, parentId and workspace directory. Use inside eval or any runtime function to learn which agent is executing without hard-coding an id; throws when the call did not originate from an agent.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<{ id: string; model: string; title: string; parentId: string | null; workspaceDir: string }> {
    const fromSession: any = session?.agent ?? (session?.agentId ? (ctx.state as any).agent?.[session.agentId] ?? await ctx.fns.session.load({ id: session.agentId }) : null);
        if (!fromSession?.id) throw new Error("agent.current: no agent in this call context");
        return { id: String(fromSession.id), model: String(fromSession.model ?? ""), title: String(fromSession.title ?? ""), parentId: fromSession.parentId ?? null, workspaceDir: String(fromSession.workspaceDir ?? "") };
}
