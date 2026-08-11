import { basename } from "node:path";

// POST /plugins/load — mount a plugin straight from a local folder and hot-load it.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const form = await opts.req.formData();
    const rawPath = String(form.get("path") ?? "").trim();
    const requestedName = String(form.get("name") ?? "").trim();
    if (!rawPath) return page(ctx, { error: "Plugin folder is required" });

    const name = requestedName || basename(rawPath.replace(/\/$/, ""));
    try {
        const mounted = await ctx.fns.plugins.load({ path: rawPath, name });
        return page(ctx, { message: `Loaded ${mounted.label || name} from ${rawPath}` });
    } catch (error: any) {
        return page(ctx, { error: String(error?.message ?? error) });
    }
}

async function page(ctx: Context, message: { message?: string; error?: string }) {
    return {
        title: "plugins",
        main: `<div class="p-6 sm:p-8">${await ctx.fns.procs.modules.panel(message)}</div>`,
    };
}
