export default async function (
    ctx: Context,
    opts: { paths: string[]; message: string; dir?: string; push?: boolean; allowEmpty?: boolean; remote?: string; branch?: string },
) {
    const staged = await ctx.fns.git.stage(ctx, { paths: opts.paths, dir: opts.dir });
    const committed = await ctx.fns.git.commit(ctx, { message: opts.message, dir: opts.dir, allowEmpty: opts.allowEmpty });
    const pushed = opts.push === false ? null : await ctx.fns.git.push(ctx, { dir: opts.dir, remote: opts.remote, branch: opts.branch });
    return { staged, committed, pushed };
}
