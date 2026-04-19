export default async function (ctx: Context) {
    const port = Number(ctx.env.PORT) || 3000;
    const logFile = Bun.file(".hyper/http.log").writer();
    (ctx.state as any).http = { logFile };

    const server = Bun.serve({
        port,
        hostname: "0.0.0.0",
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
                const res = await m.handler(ctx, null, req);
                log(logFile, req.method, url.pathname + url.search, res.status, performance.now() - t0);
                return res;
            } catch (e: any) {
                log(logFile, req.method, url.pathname + url.search, 500, performance.now() - t0, e?.message);
                throw e;
            }
        },
    });
    ctx.state.server = { server, port };
    await Bun.write(".hyper/port", String(port));
    console.log(`[server] listening on http://localhost:${port}  (written to .hyper/port)`);
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
