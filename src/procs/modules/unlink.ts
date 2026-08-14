// Take a plugin's skill link out of the project again — the other half of
// `modules.link`, run when a plugin is turned off.
//
// Only our own symlink is removed: a real directory by that name is the
// project's own skill, and un-asking for a module is not permission to delete
// somebody's files.
import { lstat, unlink } from "node:fs/promises";

/**
 * Unlink the modules subsystem operation.
 * @param opts.name The target name.
 */
export default async function (ctx: Context, _session: Session | null, opts: { name: string }): Promise<{ unlinked: boolean }> {
    const at = `${ctx.fns.procs.project.workdir({})}/.claude/skills/${opts.name}`;
    const there = await lstat(at).catch(() => null);
    if (!there?.isSymbolicLink()) return { unlinked: false };
    await unlink(at);
    ctx.fns.procs.log.info({ event: "module.unlinked", msg: opts.name });
    return { unlinked: true };
}
