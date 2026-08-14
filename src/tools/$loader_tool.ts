// Owns `mod/$tool_<name>.md` and `mod/$tool_<name>.json` — a declared tool.
//
// The declaration is DATA (schema + docs); the implementation is an ordinary
// procs function found by name — `<module>.<name>` unless the declaration says
// otherwise with `fn`. So a tool stays callable by hand from the REPL and from
// §eval, and the model is not the only thing that can reach it.
//
// `.md` = YAML frontmatter (the fields of types.tools.Tool) + a markdown body
// that becomes `doc`, the wire-format block the system prompt splices in.
// `.json` = the same fields, no prose. Collected into ctx.state.tools.registry
// keyed "<module>.<name>"; re-running replaces entries in place, so dev.sync
// hot-reloads a declaration the same way it reloads a fn.
/** Registers tool declarations discovered by the module loader. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Loader entries to register. */ entries: any[] }): Promise<void> {
    const st = ((ctx.state as any).tools ??= {});
    const registry: Map<string, any> = (st.registry ??= new Map());

    for (const e of opts.entries) {
        let decl: any;
        let doc = "";
        try {
            if (e.fileName.endsWith(".json")) {
                decl = await Bun.file(e.abs).json();
            } else if (e.fileName.endsWith(".md")) {
                const parsed = parseFrontmatter(await Bun.file(e.abs).text());
                decl = parsed.data;
                doc = parsed.body;
            } else {
                console.warn(`[tools] skip (declare a tool as .md or .json): ${e.rel}`);
                continue;
            }
        } catch (error: any) {
            console.error(`[tools] ${e.rel}: ${error?.message ?? error}`);
            continue;
        }

        if (!decl || typeof decl !== "object") {
            console.warn(`[tools] skip (empty declaration): ${e.rel}`);
            continue;
        }
        if (!decl.parameters || decl.parameters.type !== "object") {
            console.warn(`[tools] skip (parameters must be a JSON Schema object): ${e.rel}`);
            continue;
        }

        const module = e.moduleDir === "." ? "" : String(e.moduleDir).replaceAll("/", ".");
        registry.set(`${module}.${e.name}`, {
            key: `${module}.${e.name}`,
            name: e.name,
            module,
            rel: e.rel,
            doc: (decl.doc ?? doc ?? "").trim(),
            ...decl,
            // The implementation: whatever the declaration named, else the fn
            // sitting next to it. Resolved at CALL time, not here — the fn may
            // still be reloading, and a tool that points at nothing should say
            // so when someone uses it, not vanish from the catalogue.
            fn: decl.fn || `${module}.${e.name}`,
        });
    }
}

// Frontmatter: a leading `---` block parsed as YAML, the rest is the body.
// A file with no frontmatter is all body and no declaration — reported by the
// caller as "empty declaration" rather than silently registered.
function parseFrontmatter(text: string): { data: any; body: string } {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text.replace(/^﻿/, ""));
    if (!m) return { data: null, body: text };
    return { data: Bun.YAML.parse(m[1]!) as any, body: m[2] ?? "" };
}
