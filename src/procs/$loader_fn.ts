// The plain kind: a file that is a function. Ships with the framework the same
// way a module's loader ships with a module — a row in the same table, not a
// special case in the parser.
//
// A loader IS a function, like everything else here: it takes the entries of its
// kind and does what it likes with them.
import { bindSelf, dottedName, setPath, source } from "./boot/load";

export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    for (const entry of opts.entries) {
        // Imported once by the bootstrap; on a hot reload there is no entry.fn
        // and the file is read again, cache-busted.
        const fn = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        if (typeof fn !== "function") continue;
        // Metadata on the function object, the way a Clojure var carries its
        // own: where it came from, what it is called, and the comment its file
        // opens with. Readable from outside (`dev.doc`) and from inside — the
        // Proxy calls with `this` = the function, so `this.meta.module` works.
        (fn as any).meta = {
            name: dottedName(entry),
            module: entry.moduleDir.replaceAll("/", "."),
            fn: entry.runtimeName,
            rel: entry.projectRel ?? entry.rel,
            abs: entry.abs,
            doc: docOf(entry),
        };
        if (entry.moduleDir === ".") {
            // Every function has a name, and a name is a path — so a function
            // needs a module to live in. There is no nameless space at the root.
            console.warn(`[fns] ${entry.rel}: a function at the src root has no name — put it in a module`);
            continue;
        }
        setPath(ctx.state.registry, [...entry.moduleDir.split("/"), entry.runtimeName], bindSelf(fn, entry.namespace));
        // This loader runs WHILE the registry is being filled, so `log` may not
        // exist yet for the first few files — the one place that has to ask.
        (ctx.fns as any).procs?.log?.debug?.({ event: "load.fn", msg: dottedName(entry), from: source(entry) });
    }
}

// The comment a file opens with is its docstring: the leading `//` block, before
// any code. Nothing new to write — every file here already starts with one.
function docOf(entry: any): string {
    const src: string = entry.source ?? "";
    const lines = (src || readHead(entry.abs)).split("\n");
    const out: string[] = [];
    for (const line of lines) {
        const m = /^\s*\/\/ ?(.*)$/.exec(line);
        if (!m) break;
        out.push(m[1]!);
    }
    return out.join("\n").trim();
}

function readHead(abs: string): string {
    try { return require("node:fs").readFileSync(abs, "utf8").slice(0, 4000); } catch { return ""; }
}
