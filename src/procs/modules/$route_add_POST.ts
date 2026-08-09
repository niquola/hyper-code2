// POST /modules/add — declare a module in workspace.json and mount it. A name
// that resolves to nothing, a repo that will not clone: the reason comes back on
// the page rather than as a 500, so the pane keeps whatever was typed.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const form = await opts.req.formData();
    const name = String(form.get("name") ?? "").trim();
    const git = String(form.get("git") ?? "").trim();
    try {
        const added = await ctx.fns.procs.modules.add({ name, ...(git ? { git } : {}) });
        return { title: "modules", main: await ctx.fns.procs.modules.panel({ message: `Mounted ${added.name} — ${added.fns.length} fns${added.tab ? ", one tab" : ""}${added.skill ? ", a skill" : ""}` }) };
    } catch (error: any) {
        return { title: "modules", main: await ctx.fns.procs.modules.panel({ error: String(error?.message ?? error) }) };
    }
}
