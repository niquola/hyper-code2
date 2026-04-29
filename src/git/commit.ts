export default async function (ctx: Context, message: string, opts: { dir?: string; allowEmpty?: boolean } = {}) {
    if (!message?.trim()) throw new Error("commit message required");
    const args = ["commit", "-m", message];
    if (opts.allowEmpty) args.push("--allow-empty");
    return await ctx.fns.git.run(ctx, args, { dir: opts.dir });
}
