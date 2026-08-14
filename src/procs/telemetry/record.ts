// Complete one span: bounded in-memory ring plus buffered NDJSON. Records carry
// OTel field names where practical, so an exporter can be added without changing callers.
/**
 * Record the telemetry subsystem operation.
 * @param opts.name The target name.
 * @param opts.started The started value used by the operation.
 * @param opts.traceId The trace identifier.
 * @param opts.spanId The span identifier.
 * @param opts.parentSpanId The parent span identifier.
 * @param opts.status The status value.
 * @param opts.attrs Attributes attached to the operation.
 * @param opts.error The error to report.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    name: string; started: number; traceId?: string; spanId?: string; parentSpanId?: string;
    status?: "ok" | "error"; attrs?: Record<string, any>; error?: any;
}) {
    const st = ctx.state.procs?.telemetry as types.procs.telemetry.State | undefined;
    if (!st?.enabled) return;
    const ended = performance.now();
    const durationMs = Math.max(0, ended - opts.started);
    const session: any = ctx.session;
    const traceId = opts.traceId ?? session?.trace?.id ?? crypto.randomUUID().replaceAll("-", "");
    const spanId = opts.spanId ?? crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const error = opts.error;
    const record = {
        Timestamp: new Date().toISOString(),
        TraceId: traceId,
        SpanId: spanId,
        ...(opts.parentSpanId ? { ParentSpanId: opts.parentSpanId } : {}),
        Name: opts.name,
        DurationMs: Math.round(durationMs * 100) / 100,
        Status: error || opts.status === "error" ? "error" : "ok",
        Attributes: sanitize({
            ...(session?.agentId ? { "agent.id": session.agentId } : {}),
            ...(session?.trace?.route ? { "http.route": session.trace.route } : {}),
            ...(opts.attrs ?? {}),
            ...(error ? { "error.type": error?.name ?? "Error", "error.message": String(error?.message ?? error).slice(0, 1000) } : {}),
        }),
    };
    st.active.delete(spanId);
    st.recent.push(record);
    if (st.recent.length > st.maxRecent) st.recent.splice(0, st.recent.length - st.maxRecent);
    st.buffer.push(JSON.stringify(record) + "\n");
    // Bound memory even if the disk is unavailable or flushing is slow.
    if (st.buffer.length > 2000) {
        const excess = st.buffer.length - 2000;
        st.buffer.splice(0, excess);
        st.dropped += excess;
    }
    if (st.buffer.length >= 500) {
        const flush = (ctx.state.registry as any)?.procs?.telemetry?.flush;
        if (typeof flush === "function") void flush.call(flush, ctx, ctx.session, {});
    }
    if (record.Status === "error" || durationMs >= st.slowMs) {
        ctx.fns.procs.log[record.Status === "error" ? "error" : "warn"]({
            event: record.Status === "error" ? "span.error" : "span.slow",
            msg: `${opts.name} ${record.DurationMs}ms`,
            spanId, durationMs: record.DurationMs, ...record.Attributes,
        });
    }
    return record;
}

function sanitize(value: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [key, raw] of Object.entries(value)) {
        if (/authorization|cookie|token|password|secret|api.?key/i.test(key)) { out[key] = "[REDACTED]"; continue; }
        if (raw == null || typeof raw === "number" || typeof raw === "boolean") out[key] = raw;
        else if (typeof raw === "string") out[key] = raw.slice(0, 2000);
        else out[key] = JSON.stringify(raw).slice(0, 2000);
    }
    return out;
}
