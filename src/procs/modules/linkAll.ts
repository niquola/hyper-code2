// Reconcile the project's skill links with what is actually mounted — run at
// boot, so a checkout that was cloned, or a project whose `.claude/` was wiped,
// or a plugin that was turned on while this process was down, all end up with
// the agent seeing exactly the tools the host has.
//
// Linking on `modules.add` alone is not enough: that only covers the one moment
// somebody pressed a button in this process. Everything else — a fresh clone, a
// workspace.json edited by hand, a plugin that arrived with a git pull — leaves
// the host mounting a module the agent has never heard of.
//
// It links every module this host has that ships a SKILL.md — the mounted ones
// and the catalogue it could mount — and takes away our own links that point at
// something the host no longer has. A real directory somebody wrote is never
// touched; neither is a symlink we did not make (readlink has to match a folder
// with a manifest).
import { readdir, lstat, readlink } from "node:fs/promises";
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ linked: string[]; dropped: string[] }> {
    const workdir = ctx.fns.procs.project.workdir({});
    // Only a host that supervises somebody else's project has a project to link
    // into; a process whose WORKDIR is its own root would be linking to itself.
    if (resolve(workdir) === resolve(ctx.fns.procs.project.projectRoot({}))) return { linked: [], dropped: [] };

    // A SKILL.md IS the declaration "I am a tool for the agent" — so what gets
    // linked is every mounted module that ships one, not only the ones a project
    // turned on. The host's own library and its tools (aidbox, git, the kit catalogue, the
    // workbench screens) are mounted always and were therefore never linked,
    // which is exactly the case where an agent works beside a tool all day and
    // has never been told it exists.
    //
    // Not the process itself and not the supervised project: those are where the
    // links go, not what goes in them.
    const mine = (ctx.state.procs?.modules ?? []).filter((m: any) => !m.self && !m.prefix);
    const folders = new Map<string, string>();
    for (const m of mine) {
        // Its folder is where SKILL.md is: the record carries it when the
        // manifest named one, and only a container without a manifest is
        // recorded by its src.
        const folder = m.dir.split("/").pop() === "src" ? resolve(m.dir, "..") : m.dir;
        if (await Bun.file(`${folder}/SKILL.md`).exists()) folders.set(m.name, folder);
    }

    // …and every module this host SHIPS but the project has not turned on. A
    // module is off because its routes and functions are not wanted, not because
    // the agent should be unable to read that it exists — and "turn it on" is a
    // line in workspace.json the agent can only propose if it knows the name.
    // Ours means found on the host's own module path (`../libs`, `./modules`),
    // not on a plugin path: the machine's skill directories are in the same
    // catalogue, and those are the user's own — already visible to their agent
    // from their home, and nothing this project should be quietly adopting.
    const ours = (await ctx.fns.procs.modules.paths({}))
        .filter(p => !p.plugin && !p.prefixed)
        .map(p => resolve(p.dir) + "/");
    for (const m of await ctx.fns.procs.modules.catalog({})) {
        if (!m.skill || folders.has(m.name)) continue;
        if (!ours.some(dir => resolve(m.dir).startsWith(dir))) continue;
        folders.set(m.name, m.dir);
    }

    const linked: string[] = [];
    for (const [name, folder] of folders) {
        const { linked: at } = await ctx.fns.procs.modules.link({ name, folder }).catch(() => ({ linked: null }));
        if (at) linked.push(name);
    }

    // A link of ours pointing at a folder nothing mounts any more is a tool the
    // agent would read about and then not find — worse than no link at all.
    const dropped: string[] = [];
    const skills = `${workdir}/.claude/skills`;
    for (const name of await readdir(skills).catch(() => [] as string[])) {
        if (folders.has(name)) continue;
        const at = `${skills}/${name}`;
        const there = await lstat(at).catch(() => null);
        if (!there?.isSymbolicLink()) continue;                       // the project's own — leave it
        const target = await readlink(at).catch(() => "");
        // Ours are the ones that point at a module container: a folder with a
        // manifest. Anything else was linked by somebody for their own reasons.
        const manifest = await Bun.file(`${target}/package.json`).json().catch(() => null);
        if (!manifest?.procs && !manifest?.proc) continue;
        await ctx.fns.procs.modules.unlink({ name });
        dropped.push(name);
    }

    if (linked.length || dropped.length) {
        ctx.fns.procs.log.info({
            event: "modules.linked",
            msg: `${linked.length} skill${linked.length === 1 ? "" : "s"} in .claude/skills${dropped.length ? `, ${dropped.length} stale removed` : ""}`,
        });
    }
    return { linked, dropped };
}
