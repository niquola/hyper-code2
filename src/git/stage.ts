export default async function (ctx: Context, paths: string[], opts: { dir?: string } = {}) {
    if (!Array.isArray(paths) || paths.length === 0) throw new Error("paths required");
    return await ctx.fns.git.run(ctx, ["add", "--", ...paths], { dir: opts.dir });
}
