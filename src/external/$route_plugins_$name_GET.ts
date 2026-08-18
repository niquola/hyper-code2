/** Read one mounted plugin's workflow and generated live function documentation for an external harness. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: { name: string } }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    const name = opts.params.name;
    try { return Response.json(await ctx.fns.plugins.read({ name })); }
    catch (error: any) { return Response.json({ error: String(error?.message ?? error) }, { status: 404 }); }
}
