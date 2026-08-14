// `bun script/cli.ts migrate:names` — point a project written before the
// framework moved under `procs.*` at where its functions live now:
//
//   ctx.fns.ui.stats(…)   →   ctx.fns.procs.ui.stats(…)
//
// A project cloned from an older template calls `ui`, `page`, `db`, `log` — the
// names the framework used when it was the host itself. Those names are an app's
// to take now, so the call resolves to nothing and the page 500s at the first
// render. The rename is mechanical, but only where it is certain: a call is
// rewritten when `procs.<ns>.<fn>` exists in THIS registry and `<ns>.<fn>` does
// not, so a project's own `ui.entries` (or anything a mounted module really
// ships) is left exactly as it is.
//
// Dry by default — it prints what it would do. `--write` applies it.
import { Glob } from "bun";

/**
 * Run the cli migrate names command-line operation.
 * @param opts.write The write value used by the operation.
 * @param opts.dir The directory to inspect.
 */
export default async function (ctx: Context, _session: Session | null, opts: { write?: boolean; dir?: string }): Promise<{ files: string[]; calls: number }> {
    const root = opts.dir ?? ctx.fns.procs.project.workdir({});
    const registry: any = ctx.state.registry;
    const has = (path: string[]) => path.reduce((node: any, key) => (node ? node[key] : undefined), registry) instanceof Function;

    const files: string[] = [];
    let calls = 0;
    for await (const rel of new Glob("**/*.ts").scan({ cwd: `${root}/src`, dot: false })) {
        const abs = `${root}/src/${rel}`;
        const before = await Bun.file(abs).text();
        const after = before.replace(/ctx\.fns\.([a-z][\w$]*)\.([a-z][\w$]*)/g, (whole, ns, fn) => {
            if (ns === "procs" || ns === "app") return whole;
            if (has([ns, fn]) || !has(["procs", ns, fn])) return whole;
            calls++;
            return `ctx.fns.procs.${ns}.${fn}`;
        });
        if (after === before) continue;
        files.push(`src/${rel}`);
        console.log(`${opts.write ? "rewrite" : "would rewrite"}  src/${rel}`);
        if (opts.write) await Bun.write(abs, after);
    }
    if (!files.length) console.log(`nothing to rename under ${root}/src`);
    return { files, calls };
}
