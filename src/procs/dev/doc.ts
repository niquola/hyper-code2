// What a function is, from the running process — `(doc f)` / `C-h f`.
// Metadata lives on the function object (the fn loader puts it there), so this
// reads the image, not the disk.
//   ctx.fns.procs.dev.doc({ name: "procs.db.select" })   → one function
//   ctx.fns.procs.dev.doc({ q: "token" })                → everything that matches
import { getPath } from "../boot/load";

export default function (ctx: Context, _session: Session | null, opts: { name?: string; q?: string }) {
    if (opts.name) {
        const fn = getPath(ctx.state.registry, opts.name.split("."));
        if (typeof fn !== "function") throw new Error(`no such function: ${opts.name}`);
        return (fn as any).meta ?? { name: opts.name, doc: "" };
    }
    const all: any[] = [];
    const walk = (node: any) => {
        for (const v of Object.values(node ?? {})) {
            if (typeof v === "function") { if ((v as any).meta) all.push((v as any).meta); }
            else if (v && typeof v === "object") walk(v);
        }
    };
    walk(ctx.state.registry);
    // A query is WORDS, not a substring. `q: "generate app"` used to be matched
    // whole and found nothing — which reads as "this process has no such thing"
    // and sends the reader to the source tree. Every word has to appear
    // somewhere in the name or the doc; if no function has all of them, the ones
    // that have some are better than an empty answer, best first.
    const words = (opts.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    // A word in the NAME is worth more than a word in the prose: whoever typed
    // "load routes" is looking for `loadRoutes`, not for the six functions whose
    // docs mention loading routes.
    const has = (m: any, w: string) => (m.name.toLowerCase().includes(w) ? 2 : m.doc.toLowerCase().includes(w) ? 1 : 0);
    const score = (m: any) => words.reduce((n, w) => n + has(m, w), 0);
    const all_words = (m: any) => words.every(w => has(m, w) > 0);
    const hits = !words.length ? all
        : all.filter(all_words).length ? all.filter(all_words)
            : all.filter(m => score(m) > 0).sort((a, b) => score(b) - score(a)).slice(0, 20);
    return hits.sort((a, b) => (words.length ? score(b) - score(a) : 0) || a.name.localeCompare(b.name))
        .map(m => ({ name: m.name, rel: m.rel, doc: m.doc.split("\n")[0] }));
}
