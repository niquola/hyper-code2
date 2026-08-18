/** Read complete live metadata for one runtime function for an authenticated local harness. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: { module: string; name: string } }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    const dotted = `${opts.params.module}.${opts.params.name}`;
    try { return Response.json(ctx.fns.runtime.docs.get({ name: dotted })); }
    catch (error: any) { return Response.json({ error: String(error?.message ?? error) }, { status: 404 }); }
}
