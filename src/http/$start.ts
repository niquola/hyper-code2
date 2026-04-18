export default async function (ctx: Context) {
    const port = Number(ctx.env.PORT) || 3000;

    const server = Bun.serve({
        port,
        hostname: "0.0.0.0",
        async fetch(req) {
            const url = new URL(req.url);
            const m = ctx.fns.http.match(ctx.routes, req.method, url.pathname);
            if (!m) return new Response("Not Found", { status: 404 });
            (req as any).params = m.params;
            return m.handler(ctx, null, req);
        },
    });
    ctx.state.server = { server, port };
    await Bun.write(".hyper/port", String(port));
    console.log(`[server] listening on http://localhost:${port}  (written to .hyper/port)`);
}
