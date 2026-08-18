/**
 * Mints the local external-harness bearer token
 *
 * Returns and persists a scoped bearer token used by local coding-harness clients; use when starting the external gateway or repairing its local credentials.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<string> {
    const state = ((ctx.state as any).external ??= {});
        if (state.token) return state.token;
        state.token = await ctx.fns.procs.auth.sign({ sub: "external-harness", name: "external-harness", kind: "external-harness", days: 7 });
        const file = `${ctx.fns.procs.project.runtimeDir({})}/external-token`;
        await Bun.write(file, state.token);
        const { chmod } = await import("node:fs/promises");
        await chmod(file, 0o600).catch(() => {});
        return state.token;
}
