// Flush buffered spans at shutdown.
/**
 * Stop the telemetry subsystem and release its resources.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const st = ctx.state.procs?.telemetry as types.procs.telemetry.State | undefined;
    if (!st) return;
    if (st.flushTimer) clearInterval(st.flushTimer);
    await ctx.fns.procs.telemetry.flush({});
}
