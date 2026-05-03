export default async function (ctx: Context, opts: { paths: string[]; dir?: string }) {
    const paths = opts.paths;
    if (!Array.isArray(paths) || paths.length === 0) throw new Error("paths required");
    return await ctx.fns.git.run(ctx, { args: ["add", "--", ...paths], dir: opts.dir });
}
