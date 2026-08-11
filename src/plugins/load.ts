import { basename, resolve } from "node:path";

// Mount a local plugin folder and hot-load its functions/routes.
export default async function (ctx: Context, _session: Session | null, opts: { path: string; name?: string }) {
    const path = String(opts.path ?? "").trim();
    if (!path) throw new Error("plugins.load: path is required");
    const workdir = ctx.fns.procs.project.workdir({});
    const absolute = resolve(workdir, path.replace(/^~(?=\/)/, process.env.HOME ?? ""));
    const manifest = await Bun.file(`${absolute}/package.json`).json().catch(() => null);
    if (!manifest?.procs && !manifest?.proc) throw new Error(`plugins.load: ${path} has no package.json procs block`);
    return await ctx.fns.procs.modules.add({ name: String(opts.name || basename(absolute)), path });
}
