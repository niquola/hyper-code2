/** Validate and invoke one declared tool for an authenticated external harness. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: { name: string } }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    const length = Number(opts.req.headers.get("content-length") ?? 0);
    if (length > 256_000) return Response.json({ error: "body too large" }, { status: 413 });
    let args: any;
    try { args = await opts.req.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
    const result = await ctx.fns.tools.call({ name: opts.params.name, args });
    return Response.json(result, { status: result.isError ? 400 : 200 });
}
