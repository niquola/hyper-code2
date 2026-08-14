/** Stages paths for a Git commit. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Paths to stage. */ paths: string[]; /** Git working directory. */ dir?: string }) {
    const paths = opts.paths;
    if (!Array.isArray(paths) || paths.length === 0) throw new Error("paths required");
    return await ctx.fns.git.run({ args: ["add", "--", ...paths], dir: opts.dir });
}
