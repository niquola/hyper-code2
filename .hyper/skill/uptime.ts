export default async function (
    ctx: Context,
    _session: Session | null,
    _opts: {},
): Promise<{ startedAt: number; uptimeSec: number }> {
    const startedAt = Number(ctx.state.serverStart);
    return {
        startedAt,
        uptimeSec: (Date.now() - startedAt) / 1000,
    };
}