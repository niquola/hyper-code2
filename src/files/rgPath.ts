// Where ripgrep lives, looked up once per process.
//
// We use the system binary if it is there and fall back to a JS scan if it is
// not — deliberately NOT downloading one (pi's CLI does; a long-running server
// quietly fetching an executable from the network is a different proposition).
// The answer is cached including the miss, so a machine without rg does not pay
// a PATH lookup per search.
export default function (ctx: Context, _session: Session | null, _opts: {} = {}): string | null {
    const state = ((ctx.state as any).files ??= {});
    if (state.rgPath === undefined) {
        state.rgPath = Bun.which("rg") ?? null;
        if (!state.rgPath) console.warn("[files.grep] ripgrep (rg) not found — falling back to the in-process scan");
    }
    return state.rgPath;
}
