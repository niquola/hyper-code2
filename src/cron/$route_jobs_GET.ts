/** GET /cron/jobs — live htmx jobs table fragment. */
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request }) {
    return new Response(await ctx.fns.cron.panel({}), { headers: { "content-type": "text/html; charset=utf-8" } });
}
