/** Return authenticated external-gateway status and available capability counts. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    const plugins = (ctx.fns.procs.modules.list({}) as any[]).filter((module: any) => module.plugin);
    return Response.json({ ok: true, service: "hyper", plugins: plugins.length, tools: ctx.fns.tools.list({}).length });
}
