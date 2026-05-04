export default async function (ctx: Context) {
    const port = Number(ctx.env.PORT) || 3000;
    const logFile = Bun.file(".hyper/_runtime/http.log").writer();
    (ctx.state as any).http = { logFile };

    const server = Bun.serve({
        port,
        hostname: "0.0.0.0",
        // Default idleTimeout (10s) is fine for normal requests. Long-poll routes
        // override per-request via ctx.state.server.server.timeout(req, ...).
        async fetch(req) {
            const t0 = performance.now();
            const url = new URL(req.url);
            const m = ctx.fns.http.match(ctx.routes, req.method, url.pathname);
            if (!m) {
                log(logFile, req.method, url.pathname + url.search, 404, performance.now() - t0);
                return new Response("Not Found", { status: 404 });
            }
            (req as any).params = m.params;
            try {
                const raw = await m.handler(ctx, null, req);
                const res = toResponse(ctx, raw, req);
                log(logFile, req.method, url.pathname + url.search, res.status, performance.now() - t0);
                return res;
            } catch (e: any) {
                log(logFile, req.method, url.pathname + url.search, 500, performance.now() - t0, e?.message);
                throw e;
            }
        },
    });
    ctx.state.server = { server, port };
    await Bun.write(".hyper/_runtime/port", String(port));
    console.log(`[server] listening on http://localhost:${port}  (written to .hyper/_runtime/port)`);
}

// Auto-wrap handler return values:
//   Response              → passthrough
//   string                → HTML, wrapped with ctx.layout({ main: string })
//   { main, title?, ... } → HTML, wrapped with ctx.layout(opts)
//   other                 → JSON
function toResponse(ctx: Context, v: any, req?: Request): Response {
    if (v instanceof Response) return v;
    const layout = (ctx as any).layout;
    if (typeof v === "string" && layout) {
        return new Response(layout(ctx, { main: v }, req), { headers: htmlHeaders() });
    }
    if (v && typeof v === "object" && typeof v.main === "string" && layout) {
        const { status, ...opts } = v;
        return new Response(layout(ctx, opts, req), { status: status ?? 200, headers: htmlHeaders() });
    }
    return new Response(JSON.stringify(v ?? null), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

function htmlHeaders() {
    return { "content-type": "text/html; charset=utf-8" };
}

function log(sink: any, method: string, path: string, status: number, ms: number, err?: string) {
    const dur = ms < 1 ? `${ms.toFixed(2)}ms` : `${ms.toFixed(0)}ms`;
    const color = ms > 500 ? "\x1b[31m" : ms > 100 ? "\x1b[33m" : "\x1b[2m";
    const reset = "\x1b[0m";
    const ts = new Date().toISOString();
    console.log(`[http] ${method.padEnd(6)} ${String(status).padEnd(3)} ${color}${dur.padStart(7)}${reset}  ${path}${err ? `  ${err}` : ""}`);
    try {
        sink.write(`${ts} ${method.padEnd(6)} ${String(status).padEnd(3)} ${dur.padStart(7)}  ${path}${err ? `  ${err}` : ""}\n`);
        sink.flush();
    } catch { /* writer closed */ }
}
