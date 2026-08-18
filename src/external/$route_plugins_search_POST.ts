/** Search live mounted-plugin workflows and function documentation for an external harness. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    const body = await json(opts.req);
    if (body instanceof Response) return body;
    try {
        return Response.json(await ctx.fns.plugins.search({
            query: String(body.query ?? ""),
            limit: body.limit,
            functionsPerPlugin: body.functionsPerPlugin,
            mode: body.mode,
        }));
    } catch (error: any) {
        return Response.json({ error: String(error?.message ?? error) }, { status: 400 });
    }
}

async function json(req: Request): Promise<any | Response> {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > 256_000) return Response.json({ error: "body too large" }, { status: 413 });
    try { return await req.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
}
