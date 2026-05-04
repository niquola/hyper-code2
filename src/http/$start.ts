export default async function (ctx: Context) {
    const port = Number(ctx.env.PORT) || 3000;
    const logFile = Bun.file(".hyper/_runtime/http.log").writer();
    (ctx.state as any).http = { logFile };

    const server = Bun.serve({
        port,
        hostname: "0.0.0.0",
        // Default idleTimeout (10s) is fine for normal requests. Long-poll routes
        // override per-request via ctx.state.server.server.timeout(req, ...).
        fetch(req) {
            return ctx.fns.http.handleRequest(ctx, { req, logFile });
        },
    });
    ctx.state.server = { server, port };
    await Bun.write(".hyper/_runtime/port", String(port));
    console.log(`[server] listening on http://localhost:${port}  (written to .hyper/_runtime/port)`);
}