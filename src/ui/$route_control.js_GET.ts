export default async function (ctx: Context) {
    return new Response(await (ctx.fns.ui as any).controlScript(ctx), { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
}
