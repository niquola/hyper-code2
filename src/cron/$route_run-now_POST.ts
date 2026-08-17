/** POST /cron/run-now — makes a named pending occurrence immediately due. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const name = String((await opts.req.formData()).get("name") ?? "");
    try { await ctx.fns.cron.runNow({ name }); return new Response(await ctx.fns.cron.panel({ message: `Queued ${name} now` }), { headers: { "content-type": "text/html; charset=utf-8" } }); }
    catch (error: any) { return new Response(await ctx.fns.cron.panel({ error: String(error?.message ?? error) }), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }); }
}
