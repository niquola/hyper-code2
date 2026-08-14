// POST /modules/fetch — clone what workspace.json declared but the disk lacks,
// then mount it. This is the button on a module that travelled with the project
// but has never been checked out here.
/**
 * Handle the POST request for the modules route.
 * @param opts.req The incoming HTTP request.
 */
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const name = String((await opts.req.formData()).get("name") ?? "").trim();
    try {
        const { fetched } = await ctx.fns.procs.modules.fetch({ name });
        await ctx.fns.procs.modules.reload({});
        return { title: "modules", main: await ctx.fns.procs.modules.panel({ message: fetched.length ? `Fetched ${fetched.join(", ")}` : `Nothing to fetch for ${name}` }) };
    } catch (error: any) {
        return { title: "modules", main: await ctx.fns.procs.modules.panel({ error: String(error?.message ?? error) }) };
    }
}
