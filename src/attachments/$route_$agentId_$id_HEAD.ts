/** Returns headers for one validated attachment. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Incoming request. */ req: Request; /** Route values. */ params: Record<string, string> }) {
    return ctx.fns.attachments.response({ id: opts.params.id!, agentId: opts.params.agentId!, method: "HEAD" });
}
