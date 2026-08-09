// proc CLI entry. Commands are $cli_<command>.ts files (convention), dispatched
// by ctx.fns.procs.cli.run. Boots the registry only (no server).
//   bun script/cli.ts                 # list commands
//   bun script/cli.ts migrate         # run a command
//   bun script/cli.ts db:seed --n 5   # subcommand (db_seed.ts) + flags
import { bootRegistry } from "../src/$main";

const ctx = await bootRegistry();
const out = await ctx.fns.procs.cli.run({ argv: process.argv.slice(2) });
if (out !== undefined) console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
process.exit(0);
