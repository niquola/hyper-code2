export default async function (ctx: Context, _session: Session | null, opts: { dir?: string; remote?: string; branch?: string } = {}) {
    const args = ["push"];
    if (opts.remote) args.push(opts.remote);
    if (opts.branch) args.push(opts.branch);
    return await ctx.fns.git.run({ args, dir: opts.dir });
}
