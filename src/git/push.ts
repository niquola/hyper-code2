export default async function (ctx: Context, opts: { dir?: string; remote?: string; branch?: string } = {}) {
    const args = ["push"];
    if (opts.remote) args.push(opts.remote);
    if (opts.branch) args.push(opts.branch);
    return await ctx.fns.git.run(ctx, { args, dir: opts.dir });
}
