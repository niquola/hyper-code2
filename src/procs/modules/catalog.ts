// The platform catalogue: every module the machine has that this project has
// NOT asked for. Mounting one is a line in workspace.json, so this is the list
// the manager offers and the agent can read before proposing anything.
import { readdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Return catalog for the modules subsystem.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    // Containers, by the name they are mounted (and excluded) under.
    const mounted = new Set((ctx.state.procs?.modules ?? []).map(m => m.name));
    // hyper-code2: a path-mounted module may be declared under a different
    // container name (`google-local` → plugins/google). Compare real folders
    // too, otherwise the same plugin appears twice — once mounted, once as
    // available-to-mount.
    const mountedDirs = new Set<string>();
    for (const m of ctx.state.procs?.modules ?? []) {
        const dir = m.dir.endsWith("/src") ? resolve(m.dir, "..") : m.dir;
        mountedDirs.add(await realpath(dir).catch(() => resolve(dir)));
    }
    const out: Array<{ name: string; label: string; icon: string; description: string; skill: string | null; dir: string }> = [];
    for (const { dir: searchDir } of await ctx.fns.procs.modules.paths({})) {
        for (const name of await readdir(searchDir).catch(() => [] as string[])) {
            const dir = resolve(searchDir, name);
            const pkg = await Bun.file(dir + "/package.json").json().catch(() => null);
            const manifest = pkg?.procs ?? pkg?.proc ?? await Bun.file(dir + "/atomic-workspace.json").json().catch(() => null);
            if (!manifest) continue;
            if (mounted.has(name) || mountedDirs.has(await realpath(dir).catch(() => resolve(dir))) || out.some(m => m.name === name)) continue;
            out.push({ ...await ctx.fns.procs.modules.describe({ dir, name, manifest }), name, dir });
        }
    }
    return out;
}
