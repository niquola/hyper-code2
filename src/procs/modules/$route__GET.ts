// GET /modules — the module manager.
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    return { title: "modules", main: await ctx.fns.procs.modules.panel({}) };
}
