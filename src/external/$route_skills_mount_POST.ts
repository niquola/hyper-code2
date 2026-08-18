/** Publish mounted plugins into local coding-harness skill directories. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    let body: any = {};
    if (Number(opts.req.headers.get("content-length") ?? 0) > 0) {
        try { body = await opts.req.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
    }
    try { return Response.json(await ctx.fns.external.mountSkills({ targets: body.targets, prefix: body.prefix, dryRun: body.dryRun })); }
    catch (error: any) { return Response.json({ error: String(error?.message ?? error) }, { status: 400 }); }
}
