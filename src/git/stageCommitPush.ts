/** Stages changes, commits them, and optionally pushes. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Paths to stage. */ paths: string[]; /** Commit message. */ message: string; /** Git working directory. */ dir?: string; /** Whether to push after committing. */ push?: boolean; /** Whether an empty commit is allowed. */ allowEmpty?: boolean; /** Remote repository name. */ remote?: string; /** Remote branch name. */ branch?: string },
) {
    const staged = await ctx.fns.git.stage({ paths: opts.paths, dir: opts.dir });
    const committed = await ctx.fns.git.commit({ message: opts.message, dir: opts.dir, allowEmpty: opts.allowEmpty });
    const pushed = opts.push === false ? null : await ctx.fns.git.push({ dir: opts.dir, remote: opts.remote, branch: opts.branch });
    return { staged, committed, pushed };
}
