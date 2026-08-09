// Where does this function live? — `M-.` for the running image.
//   ctx.fns.procs.dev.where({ name: "procs.http.dispatch" })  → { abs, rel, module }
import { getPath } from "../boot/load";

export default function (ctx: Context, _session: Session | null, opts: { name: string }) {
    const fn = getPath(ctx.state.registry, opts.name.split("."));
    if (typeof fn !== "function") throw new Error(`no such function: ${opts.name}`);
    const meta = (fn as any).meta;
    if (!meta) throw new Error(`${opts.name} has no metadata — was it registered by hand?`);
    return { name: meta.name, module: meta.module, rel: meta.rel, abs: meta.abs };
}
