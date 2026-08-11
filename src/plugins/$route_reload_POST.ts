// POST /plugins/reload — rescan project plugins without restarting the server.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    try {
        const modules = await ctx.fns.plugins.reload({});
        const count = modules.length;
        const main = `<div class="p-6 sm:p-8">${await ctx.fns.procs.modules.panel({ message: `Reloaded ${count} plugin${count === 1 ? "" : "s"}` })}</div>`;
        return { title: "plugins", main };
    } catch (error: any) {
        const main = `<div class="p-6 sm:p-8">${await ctx.fns.procs.modules.panel({ error: String(error?.message ?? error) })}</div>`;
        return { title: "plugins", main };
    }
}
