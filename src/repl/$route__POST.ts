export default async function (ctx: Context, _session: any, request: Request) {
    const code = await request.text();
    try {
        const result = await ctx.fns.repl.eval(ctx, { code });
        return new Response(JSON.stringify({ success: true, result }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { status: 500 });
    }
}
