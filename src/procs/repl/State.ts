// ctx.state.procs?.repl — the REPL's own state.
export type State = {
    // The token a REPL call must carry, minted once per run by repl.token and
    // mirrored into .runtime/repl-token for clients on this machine.
    token?: string;
};
