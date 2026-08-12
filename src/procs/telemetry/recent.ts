// Snapshot recent/active spans for REPL and the future diagnostics UI.
export default function (ctx: Context, _session: Session | null, opts: { limit?: number; active?: boolean } = {}) {
    const st = ctx.state.procs?.telemetry as types.procs.telemetry.State | undefined;
    if (!st) return [];
    if (opts.active) return [...st.active.values()];
    return st.recent.slice(-Math.max(1, Math.min(opts.limit ?? 100, st.maxRecent)));
}
