// GET /plugins — project-local plugin manager.
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request }) {
    return { title: "plugins", main: `<div class="p-6 sm:p-8">${await ctx.fns.procs.modules.panel({})}</div>` };
}
