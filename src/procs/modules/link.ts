// Make a plugin visible to the coding agent: a symlink at
// `WORKDIR/.claude/skills/<name>` pointing at the container's own folder.
//
// A module and a skill are the same directory read by two readers — the host
// reads the `procs` block of its package.json, the agent reads its `SKILL.md` —
// so turning a plugin on for a project should hand it to both. It did not: the
// host mounted it out of wherever it lives (a shared library, the machine's
// catalogue) and the agent working in that project never saw it, which is how
// "the workspace has this tool and Claude does not know" happens.
//
// A symlink rather than a copy, because there is one copy and it stays where it
// is; `.claude/` is already excluded from the project's git, so nothing lands in
// somebody's repository. An existing entry that is not our symlink is left
// alone — the project may have written its own skill by that name, and that one
// wins.
import { mkdir, symlink, lstat, readlink, unlink } from "node:fs/promises";
import { resolve } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { name: string; folder?: string }): Promise<{ linked: string | null; why?: string }> {
    const workdir = ctx.fns.procs.project.workdir({});
    const record = (ctx.state.procs?.modules ?? []).find((m: any) => m.name === opts.name);
    const folder = opts.folder ?? (record ? folderOf(record.dir) : "");
    if (!folder) return { linked: null, why: `no mounted module called ${opts.name}` };

    const skills = `${workdir}/.claude/skills`;
    const at = `${skills}/${opts.name}`;
    if (resolve(at) === resolve(folder)) return { linked: null, why: "it already lives there" };

    await mkdir(skills, { recursive: true });
    const there = await lstat(at).catch(() => null);
    if (there?.isSymbolicLink()) {
        if (await readlink(at).catch(() => "") === folder) return { linked: at };
        await unlink(at);                      // ours, pointing somewhere stale
    } else if (there) {
        return { linked: null, why: "a real directory is already there — the project's own skill wins" };
    }

    await symlink(folder, at, "dir");
    ctx.fns.procs.log.info({ event: "module.linked", msg: `${opts.name} → ${folder}` });
    return { linked: at };
}

// The container's folder, not its `src`: SKILL.md and package.json live at the
// top of it. A record's `dir` is already the folder when the manifest named one
// (`r.folder ?? r.dir` in the loader), and only a container without a manifest
// is recorded by its src — hence the one step up, and only then.
const folderOf = (dir: string) => (dir.split("/").pop() === "src" ? resolve(dir, "..") : dir);
