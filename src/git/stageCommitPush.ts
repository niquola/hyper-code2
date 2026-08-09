export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { paths: string[]; message: string; dir?: string; push?: boolean; allowEmpty?: boolean; remote?: string; branch?: string },
) {
    const staged = await ctx.fns.git.stage({ paths: opts.paths, dir: opts.dir });
    const committed = await ctx.fns.git.commit({ message: opts.message, dir: opts.dir, allowEmpty: opts.allowEmpty });
    const pushed = opts.push === false ? null : await ctx.fns.git.push({ dir: opts.dir, remote: opts.remote, branch: opts.branch });
    return { staged, committed, pushed };
}
