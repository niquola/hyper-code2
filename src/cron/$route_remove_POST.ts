/** POST /cron/remove — cancels pending occurrences of a named schedule. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const name = String((await opts.req.formData()).get("name") ?? "");
    try { const result = await ctx.fns.cron.remove({ name }); return new Response(await ctx.fns.cron.panel({ message: `Removed ${result.removed} pending occurrence(s) of ${name}` }), { headers: { "content-type": "text/html; charset=utf-8" } }); }
    catch (error: any) { return new Response(await ctx.fns.cron.panel({ error: String(error?.message ?? error) }), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } }); }
}
