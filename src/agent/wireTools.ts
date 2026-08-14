// The tool definitions this agent sends on the wire, in the dialect the
// endpoint speaks. One place answers the question — narrowing (agent.tools),
// dialect, schema shape — so a streamer just drops the result into the body.
/** Wire tools for the runtime.  * @param opts.agent Agent whose state is read or updated.
 * @param opts.api Provider API dialect.
*/
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Live agent instance to operate on. */
    agent: types.agent.Agent;
        /** Api used by the operation. */
    api: string },
): any[] {
    return ctx.fns.tools.schemas({ api: opts.api, only: opts.agent.tools });
}
