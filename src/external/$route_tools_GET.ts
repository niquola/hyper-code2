/** List declared schema-validated tools available to an authenticated external harness. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    const tools = ctx.fns.tools.list({}).map((tool: any) => ({
        name: tool.wireName,
        key: tool.key,
        module: tool.module,
        description: tool.description,
        parameters: tool.parameters,
    }));
    return Response.json(tools);
}
