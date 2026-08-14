// GET /plugins — project-local plugin manager.
/** Handles the corresponding HTTP route. */
export default async function (ctx: Context, _session: Session | null, _opts: { /** Incoming HTTP request. */ req: Request }) {
    return { title: "plugins", main: `<div class="p-6 sm:p-8">${await ctx.fns.procs.modules.panel({})}</div>` };
}
