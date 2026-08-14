export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    return new Response(await ctx.fns.ui.controlScript({}), { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
}
