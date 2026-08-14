/** Pushes Git commits to a remote. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Git working directory. */ dir?: string; /** Remote repository name. */ remote?: string; /** Remote branch name. */ branch?: string } = {}) {
    const args = ["push"];
    if (opts.remote) args.push(opts.remote);
    if (opts.branch) args.push(opts.branch);
    return await ctx.fns.git.run({ args, dir: opts.dir });
}
