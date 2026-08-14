// Turn a REPL failure into the next thing to do, when the failure is one this
// process can recognise.
//
// The one that keeps happening: somebody writes `src/footcheck/register.ts`,
// calls `ctx.fns.footcheck.register({})` in the same breath, and gets
// `undefined is not an object`. Every word of that is true and none of it says
// what happened — the file is on disk and the process has not been told. The
// rule is written in two places already; a rule that has to be remembered at the
// exact moment of the mistake is better said by whoever notices it.
//
// So: only when a name in the message is genuinely a gap in the registry, and
// only when the answer is short and certain. Everything else is returned
// unexplained rather than guessed at — a wrong hint costs more than none.
/**
 * Perform explain for the repl subsystem.
 * @param opts.error The error to report.
 */
export default function (ctx: Context, _session: Session | null, opts: { error: any }): string | null {
    const message = String(opts.error?.message ?? opts.error ?? "");

    // `ctx.fns.a.b` where `a` is not there at all, or is there without `b`.
    const missing = /evaluating '(?:ctx\.)?fns\.([A-Za-z0-9_$.]+)'/.exec(message)
        ?? /(?:ctx\.)?fns\.([A-Za-z0-9_$.]+) is not a function/.exec(message);
    if (!missing) return null;

    const path = missing[1]!.split(".");
    const held = path.reduce<any>((node, key) => (node == null ? node : node[key]), ctx.fns as any);
    if (typeof held === "function") return null;                       // it exists; the throw was from inside it

    const [head, ...rest] = path;
    const namespace = (ctx.fns as any)[head!];
    if (!namespace) {
        const near = Object.keys(ctx.fns as any).filter(name => name.startsWith(head!.slice(0, 3))).slice(0, 5);
        return `no module called \`${head}\` is mounted${near.length ? ` — near it: ${near.join(", ")}` : ""}. `
            + `\`ctx.fns.procs.dev.doc({ q: "${head}" })\` searches every name and docstring here.`;
    }

    // The module is there and the function is not. If the project's own tree has
    // a file that would carry that name, this is the un-remounted case.
    const own = Object.keys(namespace).slice(0, 12);
    const rel = `${rest.join("/")}.ts`;
    const inProject = head === "app" && Bun.file(`${ctx.fns.procs.project.workdir({})}/src/${rel}`).size > 0;
    if (inProject) {
        return `\`src/${rel}\` is on disk and this process has not read it. Remount once, then call it again: `
            + `\`await ctx.fns.services.restart({ name: "app" })\` (one file: \`procs.dev.sync({ rel: "${rel}" })\`).`;
    }
    return `\`${head}\` is mounted and has no \`${rest.join(".")}\`. It has: ${own.join(", ")}${Object.keys(namespace).length > 12 ? " …" : ""}. `
        + `\`ctx.fns.procs.dev.doc({ q: "${rest.at(-1)}" })\` looks for it everywhere.`;
}
