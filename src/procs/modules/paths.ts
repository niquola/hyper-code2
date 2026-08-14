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

// Where PLUGINS are looked for — the directories whose subfolders are offered as
// a catalogue rather than mounted because the host ships them. The default is
// the agent's skill directories, which is what makes a skill a plugin; a host
// says otherwise with `"procs": { "plugins": [...] }` in its package.json, and a
// run with `PROCS_PLUGINS` (colon-separated).
//
// `PROCS_PLUGINS=""` is the clean path: no catalogue at all, nothing read out of
// anybody's home folder. That matters everywhere that is not a laptop — a
// deploy, a test, a demo of what a fresh clone does — because otherwise the
// composition of the process depends on whose machine it runs on.
// hyper-code2: the plugin catalogue is project-local. Upstream also reads the
// Claude/Codex skill homes, but those hold prompt/document skills rather than
// executable modules, and offering them in /procs/modules invites mounting a
// directory that has no code to run. A host can still name another catalogue
// explicitly through procs.plugins or PROCS_PLUGINS.
const PLUGIN_DEFAULTS: string[] = [];

// `plugin` marks the ones that are a CATALOGUE rather than this host's own
// library: the machine's skill directories and the project's, whose contents
// belong to whoever wrote them. What the host itself ships is the rest.
export type SearchPath = { dir: string; prefixed: boolean; plugin: boolean };

/**
 * Resolves existing, deduplicated module and plugin search paths.
 * Honors `PROCS_PATH` and `PROCS_PLUGINS`, then package configuration and defaults.
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
    const paths = [...own.map(path => ({ path, plugin: false })), ...plugins.map(path => ({ path, plugin: true }))];
    const out: SearchPath[] = [];
    for (const { path, plugin } of paths) {
        const prefixed = path.endsWith("/*");
        const bare = prefixed ? path.slice(0, -2) : path;
        // realpath collapses the symlinks the agent homes point at each other
        // with, so the same directory is not scanned (and mounted) twice.
        const base = bare.startsWith("./") || bare.startsWith("../") ? root : project;
        const dir = await realpath(resolve(base, expandHome(bare))).catch(() => null);
        if (!dir || out.some(p => p.dir === dir)) continue;
        if (await Bun.file(dir).stat().then(s => s.isDirectory()).catch(() => false)) out.push({ dir, prefixed, plugin });
    }
    return out;
}
