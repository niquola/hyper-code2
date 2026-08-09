// Mint the run's REPL token before anything can call the endpoint, so a client
// on this machine finds .runtime/repl-token already there. Minting it lazily
// meant the first call raced the file into existence and failed.
export default async function (ctx: Context, _config?: unknown) {
    await ctx.fns.procs.repl.token({});
}
