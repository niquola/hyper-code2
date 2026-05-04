export default async function (ctx: Context, opts: { req: Request; logFile?: any }): Promise<Response> {
    const req = opts.req;
    const logFile = opts.logFile;
    const t0 = performance.now();
    const url = new URL(req.url);
    const m = ctx.fns.http.match(ctx.routes, req.method, url.pathname);

    try {
        if (!m) {
            const raw = await render404(ctx, req);
            const res = toResponse(ctx, raw, req);
            log(logFile, req.method, url.pathname + url.search, res.status, performance.now() - t0);
            return res;
        }

        (req as any).params = m.params;
        const raw = await m.handler(ctx, null, req);
        const res = toResponse(ctx, raw, req);
        log(logFile, req.method, url.pathname + url.search, res.status, performance.now() - t0);
        return res;
    } catch (e: any) {
        log(logFile, req.method, url.pathname + url.search, 500, performance.now() - t0, e?.message);
        throw e;
    }
}

async function render404(ctx: Context, req: Request) {
    const route = ctx.routes?.["/404"]?.GET;
    if (typeof route === "function") return await route(ctx, null, req);
    return {
        title: "404",
        main: `<div class="flex-1 flex items-center justify-center">
  <div class="text-center">
    <div class="text-6xl font-semibold tracking-tight text-gray-300">404</div>
    <div class="mt-3 text-sm text-gray-500">Page not found</div>
  </div>
</div>`,
        status: 404,
    };
}

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
    if (!sink) return;
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