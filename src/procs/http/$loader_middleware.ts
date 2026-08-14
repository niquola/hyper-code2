// `<module>/$middleware[_<path>].ts` — runs before the handlers under its
// prefix. General prefixes first: the outermost runs first, the most specific
// last, which is why this loader takes them all at once and sorts.
import { bindSelf } from "../boot/load";

/**
 * Load loader middleware declarations into the runtime.
 * @param opts.entries The loader entries to register.
 */
export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    const list = (ctx.state.procs.http.middleware ??= []);
    for (const entry of opts.entries) {
        const handler = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        if (typeof handler !== "function") { console.warn(`[middleware] skip (no default export): ${entry.root}/${entry.rel}`); continue; }
        list.push({ prefix: entry.prefix, segs: entry.prefix.split("/").filter(Boolean), handler: bindSelf(handler, entry.namespace) });
        ctx.fns.procs.log.debug({ event: "load.middleware", msg: `${entry.prefix}/*`, from: `${entry.root}/${entry.rel}` });
    }
    list.sort((a, b) => a.segs.length - b.segs.length);
}
