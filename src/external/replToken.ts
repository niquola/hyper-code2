/**
 * Mints the privileged local external REPL bearer token
 *
 * Returns and persists a separate scoped token for arbitrary loopback-only runtime evaluation by trusted local coding harnesses.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<string> {
    const state = ((ctx.state as any).external ??= {});
        if (state.replToken) return state.replToken;
        state.replToken = await ctx.fns.procs.auth.sign({ sub: "external-repl", name: "external-repl", kind: "external-repl", days: 7 });
        const file = `${ctx.fns.procs.project.runtimeDir({})}/external-repl-token`;
        await Bun.write(file, state.replToken);
        const { chmod } = await import("node:fs/promises");
        await chmod(file, 0o600).catch(() => {});
        return state.replToken;
}
