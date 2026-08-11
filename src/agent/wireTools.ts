// The tool definitions this agent sends on the wire, in the dialect the
// endpoint speaks. One place answers the question — narrowing (agent.tools),
// dialect, schema shape — so a streamer just drops the result into the body.
export default function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; api: string },
): any[] {
    return ctx.fns.tools.schemas({ api: opts.api, only: opts.agent.tools });
}
