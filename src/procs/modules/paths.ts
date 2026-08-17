import { resolve } from "node:path";
import { realpath } from "node:fs/promises";
// Bootstrap path: roots/scan run before the registry exists, so these are
// imported directly rather than called through ctx.fns.
import projectRoot from "../project/projectRoot";
import workdir, { expandHome } from "../project/workdir";

// Where this process looks for modules, in order. An app says so in its own
// `package.json` — `"procs": { "path": ["../libs", "./modules"] }` — because the
// composition of a process is data, not a line in its entry point. `PROCS_PATH`
// (colon-separated) overrides it for a run; the defaults below are the fallback.
//
// A module IS a skill directory: the project keeps its own in
// WORKDIR/.claude/skills, where the coding agent finds them as skills by itself
// and the host finds them as modules by their manifest. "./…" and "../…" resolve
// against the host's own repo, a bare relative path against the project.
//
// A path that ends in `/*` is a **folder of installed projects**: everything
// under it is mounted, each under its own folder name as a prefix, because two
// projects that both ship `patients/` must not become one namespace. That is how
// a clinical host points at the directory a manager keeps its workspaces in —
// `"path": ["../libs", "./apps/*"]`, or `PROCS_PATH=…:/srv/WORKSPACES/*` — and
// gets every app in every project without naming them one by one.
const DEFAULTS = ["./modules"];

// Official plugins are shipped by the host and configured through `procs.plugins`
// or `PROCS_PLUGINS`. User plugins are a separate writable root outside the host
// repository. Every valid direct child of `USER_PLUGINS` is mounted automatically.
// An absent or empty `USER_PLUGINS` disables that layer.
const PLUGIN_DEFAULTS: string[] = [];

export type SearchPath = {
    dir: string;
    prefixed: boolean;
    kind: "module" | "official" | "user";
};

/**
 * Resolves existing, deduplicated module, official-plugin, and user-plugin roots.
 * Honors `PROCS_PATH`, `PROCS_PLUGINS`, and `USER_PLUGINS` without creating paths.
 */
export default async function (ctx: Context, session: Session | null, _opts?: {}): Promise<SearchPath[]> {
    const root = projectRoot(ctx, session, {});
    const project = workdir(ctx, session, {});
    const declared = await Bun.file(`${root}/package.json`).json()
        .then((pkg: any) => (pkg.procs ?? pkg.proc)?.path as string[] | undefined)
        .catch(() => undefined);
    const plugins = ctx.env.PROCS_PLUGINS !== undefined
        ? ctx.env.PROCS_PLUGINS.split(":").filter(Boolean)
        : await Bun.file(`${root}/package.json`).json()
            .then((pkg: any) => ((pkg.procs ?? pkg.proc)?.plugins as string[] | undefined) ?? PLUGIN_DEFAULTS)
            .catch(() => PLUGIN_DEFAULTS);
    const own = ctx.env.PROCS_PATH ? ctx.env.PROCS_PATH.split(":").filter(Boolean) : (declared?.length ? declared : DEFAULTS);
    const user = (ctx.env.USER_PLUGINS ?? "").trim();
    const paths: Array<{ path: string; kind: SearchPath["kind"] }> = [
        ...own.map(path => ({ path, kind: "module" as const })),
        ...plugins.map(path => ({ path, kind: "official" as const })),
        ...(user ? [{ path: user, kind: "user" as const }] : []),
    ];
    const out: SearchPath[] = [];
    for (const { path, kind } of paths) {
        const prefixed = path.endsWith("/*");
        const bare = prefixed ? path.slice(0, -2) : path;
        // realpath collapses aliases and symlinks so one plugin is never loaded
        // twice when roots overlap.
        const base = bare.startsWith("./") || bare.startsWith("../") ? root : project;
        const dir = await realpath(resolve(base, expandHome(bare))).catch(() => null);
        if (!dir || out.some(p => p.dir === dir)) continue;
        if (await Bun.file(dir).stat().then(s => s.isDirectory()).catch(() => false)) out.push({ dir, prefixed, kind });
    }
    return out;
}
