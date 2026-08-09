// `bun script/cli.ts generate:repl [--force]` — write the REPL client into this
// app. The bootstrap case: an app with no script/repl.ts yet has no way to talk
// to its own process, and this is how it gets one.
export default async function (ctx: Context, _session: Session | null, opts?: { force?: boolean }) {
    const { written } = await ctx.fns.procs.generate.repl({ force: opts?.force });
    return written ? { written } : { written: null, note: "script/repl.ts exists — pass --force to overwrite" };
}
