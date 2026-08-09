// ctx.state.procs?.auth — a module's state lives under the module's own name, so where
// to look is never a question.
export type State = {
    // The signing key for this machine, loaded or generated once by auth.keys
    // and kept in .runtime/auth-key.json.
    keys?: { privateKey: CryptoKey; publicKey: CryptoKey; jwk: Awaited<ReturnType<typeof crypto.subtle.exportKey>> };
};
