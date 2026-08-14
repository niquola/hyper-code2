/** For agent for the runtime. */
export default function (
    _ctx: Context,
    session: Session | null,
    opts: {
        /** Live agent instance to operate on. */
    agent: types.agent.Agent },
): Session {
    return {
        ...(session ?? {}),
        kind: session?.kind ?? "agent",
        agentId: opts.agent.id,
        agent: opts.agent,
    };
}