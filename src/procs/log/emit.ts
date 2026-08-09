// Core log emitter — level gate + pretty/json formatting.
// All level functions (info/warn/error/debug) delegate here.
const OTEL_SEV: Record<string, number> = { debug: 5, info: 9, warn: 13, error: 17 };
const LEVEL_NUM: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS: Record<string, string> = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
const RESET = "\x1b[0m";

export default function (ctx: Context, _session: Session | null, opts: {
    severity: string;
    event: string;
    msg?: string;
    attrs?: Record<string, any>;
}) {
    // Before log/$start has run — during boot, in a CLI, in a test — there is no
    // configured state yet, and the framework's own chatter still has to go
    // somewhere. So the gate falls back to the environment rather than to
    // silence.
    const st = ctx.state.procs?.log ?? {
        level: LEVEL_NUM[ctx.env.LOG_LEVEL ?? "info"] ?? 2,
        format: (ctx.env.LOG_FORMAT ?? "pretty") as "pretty" | "json",
        service: ctx.env.SERVICE_NAME ?? "procs",
    };

    const num = LEVEL_NUM[opts.severity];
    if (num === undefined || num > st.level) return;

    const ts = new Date().toISOString();
    const body = opts.msg ?? opts.event;

    if (st.format === "json") {
        const attrs: Record<string, any> = { event: opts.event, ...(opts.attrs ?? {}), ...traceOf(ctx) };
        const record: types.procs.log.LogRecord = {
            Timestamp: ts,
            SeverityNumber: OTEL_SEV[opts.severity]!,
            SeverityText: opts.severity.toUpperCase(),
            Body: body,
            Attributes: attrs,
            Resource: { "service.name": st.service },
            TraceId: ctx.session?.trace?.id,
        };
        process.stdout.write(JSON.stringify(record) + "\n");
    } else {
        const color = COLORS[opts.severity] ?? "";
        const a = opts.attrs;
        const trace = ctx.session?.trace?.id;
        const kvs = a ? Object.entries(a).map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ") : "";
        console.log(`${color}[${opts.event}]${RESET}${trace ? ` \x1b[2m${trace}\x1b[0m` : ""} ${body}${kvs ? "  " + kvs : ""}`);
    }
}

// Everything a line inherits from the call it happens inside. The session is
// already carried down every `ctx.fns.*` call, so nobody passes any of this: one
// request's lines share a trace id, and `user`/`route` say whose and where.
function traceOf(ctx: Context): Record<string, any> {
    const s = ctx.session;
    if (!s) return {};
    const out: Record<string, any> = {};
    if (s.trace?.id) out["trace.id"] = s.trace.id;
    if (s.trace?.route) out["http.route"] = s.trace.route;
    if (s.req) { out["http.method"] = s.req.method; out["http.url"] = s.url?.pathname ?? new URL(s.req.url).pathname; }
    const user = (s as any).user;
    if (user?.sub || user?.email) out["user.id"] = user.sub ?? user.email;
    return out;
}
