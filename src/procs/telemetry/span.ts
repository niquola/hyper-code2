// Run an operation under a nested async span. AsyncLocalStorage preserves the
// parent across concurrent requests and agent runs without changing sync fns
// into promises (many procedural helpers intentionally return synchronously).
/**
 * Perform span for the telemetry subsystem.
 * @param opts.name The target name.
 * @param opts.attrs Attributes attached to the operation.
 * @param opts.fn The fn value used by the operation.
 */
export default function <T>(ctx: Context, _session: Session | null, opts: {
    name: string; attrs?: Record<string, any>; fn: () => T;
}): T {
    const st = ctx.state.procs?.telemetry as types.procs.telemetry.State | undefined;
    if (!st?.enabled || opts.name.startsWith("procs.telemetry.")) return opts.fn();
    const state = st;
    const parent = state.als.getStore();
    const session: any = ctx.session;
    const traceId = parent?.traceId ?? session?.trace?.id ?? crypto.randomUUID().replaceAll("-", "");
    const spanId = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const started = performance.now();
    const current = { traceId, spanId, parentSpanId: parent?.spanId, name: opts.name, startedAt: Date.now(), attrs: opts.attrs ?? {} };
    state.active.set(spanId, current);
    return state.als.run(current, () => {
        try {
            const result: any = opts.fn();
            if (result && typeof result.then === "function") {
                return result.then(
                    (value: any) => { finish(); return value; },
                    (error: any) => { finish(error); throw error; },
                );
            }
            finish();
            return result;
        } catch (error) {
            finish(error);
            throw error;
        }
    });

    function finish(error?: any) {
        // Recording is side-effect-only. A broken sink/logger must never change
        // the operation's result or rejection.
        try {
            const record = (ctx.state.registry as any)?.procs?.telemetry?.record;
            if (typeof record === "function") record.call(record, ctx, ctx.session, {
                name: opts.name, started, traceId, spanId, parentSpanId: parent?.spanId, attrs: opts.attrs, error,
            });
            else state.active.delete(spanId);
        } catch {
            state.active.delete(spanId);
            state.dropped++;
        }
    }
}
