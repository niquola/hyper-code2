export default async function (ctx: Context) {
    ctx.routes = ctx.routes || {};
    const entries = await ctx.fns.project.scan(ctx);
    for (const entry of entries) {
        if (entry.kind === 'route') {
            const mod = await import(entry.abs + `?t=${Date.now()}`);
            const handler = mod.default;
            if (typeof handler !== 'function') {
                console.warn(`[routes] skip (no default export): ${entry.root}/${entry.rel}`);
                continue;
            }
            const routeBucket = (ctx.routes[entry.routePath] ??= {});
            routeBucket[entry.method] = handler;
            console.log(`[routes] ${entry.method.padEnd(6)} ${entry.routePath}  ←  ${entry.root}/${entry.rel}`);
            continue;
        }
        if (entry.kind === 'script') {
            const abs = entry.abs;
            const handler = (() => async () => new Response(Bun.file(abs)))();
            const routeBucket = (ctx.routes[entry.routePath] ??= {});
            routeBucket.GET = handler;
            console.log(`[scripts] GET    ${entry.routePath}  ←  ${entry.root}/${entry.rel}`);
        }
    }
    return ctx.routes;
}
