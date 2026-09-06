/** Accepts text and multipart file attachments as one durable user turn. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Incoming request. */ req: Request; /** Route values. */ params: Record<string, string> }) {
    return ctx.fns.agent.acceptMessage({ req: opts.req, params: opts.params });
}
