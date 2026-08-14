/** Wake in for the runtime.  * @param opts.id Target agent identifier.
 * @param opts.delayMs Wake delay in milliseconds.
 * @param opts.reason Human-readable wake-up reason.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent identifier. */
    id: string;
        /** Delay in milliseconds. */
    delayMs: number;
        /** Human-readable reason for the operation. */
    reason: string },
): Promise<{ wakeAt: number; reason: string }> {
    const delayMs = Math.max(1000, Math.floor(Number(opts.delayMs)));
    if (!Number.isFinite(delayMs)) throw new Error("wakeIn: delayMs is required");
    return await ctx.fns.agent.wakeAt({ id: opts.id, at: Date.now() + delayMs, reason: opts.reason });
}
