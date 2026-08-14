// POST /modules/remove — un-ask for a module and remount.
/**
 * Handle the POST request for the modules route.
 * @param opts.req The incoming HTTP request.
 */
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const name = String((await opts.req.formData()).get("name") ?? "").trim();
    try {
        await ctx.fns.procs.modules.remove({ name });
        return { title: "modules", main: await ctx.fns.procs.modules.panel({ message: `Removed ${name}` }) };
    } catch (error: any) {
        return { title: "modules", main: await ctx.fns.procs.modules.panel({ error: String(error?.message ?? error) }) };
    }
}
