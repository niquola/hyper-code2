// Dispatch argv to a $cli_<command>.ts handler (collected into ctx.state.procs?.cli).
// `$cli_db_seed.ts` → command `db:seed`. No command / --help → list commands.
//   bun script/cli.ts <command> [--flag value] [positionals]
export default async function (ctx: Context, session: Session | null, opts: { argv: string[] }) {
    const { command, opts: parsed } = ctx.fns.procs.cli.parse({ argv: opts.argv });
    const commands = ctx.state.procs?.cli ?? {};

    if (!command || command === "help" || parsed.help) {
        return { commands: Object.keys(commands).sort(), usage: "bun script/cli.ts <command> [--flag value]" };
    }
    const fn = commands[command];
    if (!fn) throw new Error(`unknown command "${command}". known: ${Object.keys(commands).sort().join(", ") || "(none)"}`);
    return fn(ctx, session, parsed);
}
