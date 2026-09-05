/**
 * Show a persisted source message with a backlink to its chat.
 * @param opts.req Incoming HTTP request.
 * @param opts.params Durable source agent and message index from the route.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming HTTP request. */ req: Request;
    /** Durable source agent and message index from the route. */ params: { id: string; idx: string };
}): Promise<Response | { title: string; main: string }> {
    return ctx.fns.agent.sourceMessagePage({ id: opts.params.id, idx: Number(opts.params.idx) });
}
