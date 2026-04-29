export default async function (ctx: Context, opts: { dir?: string; staged?: boolean } = {}) {
    return await ctx.fns.git.run(ctx, ["status", opts.staged ? "--short" : "--short", ...(opts.staged ? ["--untracked-files=no"] : [])], { dir: opts.dir });
}
