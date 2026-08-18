// POST /external/repl — arbitrary live-runtime evaluation for trusted local
// harnesses. This intentionally has the same power as the framework REPL, but
// uses a separate token so ordinary capability clients cannot escalate.
/** Execute arbitrary ctx-scoped code for a privileged loopback harness. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }): Promise<Response> {
    if (ctx.env.NODE_ENV === "production") return Response.json({ error: "external REPL disabled" }, { status: 403 });
    const auth = await ctx.fns.external.authorizeRepl({ req: opts.req });
    if (!auth.ok) return auth.response;
    const length = Number(opts.req.headers.get("content-length") ?? 0);
    if (length > 256_000) return Response.json({ error: "REPL body too large" }, { status: 413 });
    try {
        const result = await ctx.fns.procs.repl.eval({ code: await opts.req.text() });
        return Response.json({ success: true, output: result.output, return: result.return });
    } catch (error: any) {
        return Response.json({ error: String(error?.message ?? error), stack: error?.stack }, { status: 500 });
    }
}
