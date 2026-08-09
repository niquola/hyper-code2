// The token a REPL call must carry: a JWT this process signs with its own key,
// `kind: "repl"` — so it opens the REPL and nothing else. `auth.authenticate`
// refuses any token that carries a `kind`, which is what keeps it from ever
// being mistaken for a session cookie.
//
// Minted once per run and mirrored into .runtime/repl-token (0600), so a client
// on this machine can read it and nothing off the machine can.
import { chmod } from "node:fs/promises";

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string> {
    const state = (ctx.state.procs.repl ??= {});
    if (state.token) return state.token;

    state.token = await ctx.fns.procs.auth.sign({
        sub: "repl", name: "repl", kind: "repl",
        // A run's token, not a session: long enough for a working day, short
        // enough that a copied one dies on its own.
        days: 1,
    });
    const file = `${ctx.fns.procs.project.runtimeDir({})}/repl-token`;
    await Bun.write(file, state.token);
    await chmod(file, 0o600).catch(() => { /* an fs without modes */ });
    return state.token;
}
