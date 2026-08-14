export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; delayMs: number; reason: string },
): Promise<{ wakeAt: number; reason: string }> {
    const delayMs = Math.max(1000, Math.floor(Number(opts.delayMs)));
    if (!Number.isFinite(delayMs)) throw new Error("wakeIn: delayMs is required");
    return await ctx.fns.agent.wakeAt({ id: opts.id, at: Date.now() + delayMs, reason: opts.reason });
}
