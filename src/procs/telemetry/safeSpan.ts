// Fail-open instrumentation boundary. Only tracer failures are suppressed;
// operation failures retain their original value/stack and are rethrown.
export default function <T>(ctx: Context, _session: Session | null, opts: {
    name: string; attrs?: Record<string, any>; fn: () => T;
}): T {
    const telemetry: any = (ctx.fns.procs as any)?.telemetry;
    const span = telemetry?.span;
    if (typeof span !== "function" || !ctx.state.procs?.telemetry?.enabled) return opts.fn();
    try {
        return span(opts);
    } catch (telemetryError) {
        try { console.error("[telemetry.disabled]", (telemetryError as any)?.message ?? telemetryError); } catch {}
        if (ctx.state.procs?.telemetry) ctx.state.procs.telemetry.enabled = false;
        return opts.fn();
    }
}
