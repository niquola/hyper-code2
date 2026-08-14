/** Creates a Git commit. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Commit message. */ message: string; /** Git working directory. */ dir?: string; /** Whether an empty commit is allowed. */ allowEmpty?: boolean }) {
    const message = opts.message;
    if (!message?.trim()) throw new Error("commit message required");
    const args = ["commit", "-m", message];
    if (opts.allowEmpty) args.push("--allow-empty");
    return await ctx.fns.git.run({ args, dir: opts.dir });
}
