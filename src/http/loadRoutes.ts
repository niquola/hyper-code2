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
            const routeBucket = (ctx.routes[entry.routePath] ??= {});
            routeBucket.GET = async () => {
                const built = await buildScript(entry.abs, entry.fileName);
                return new Response(Bun.file(built), {
                    headers: {
                        'content-type': contentTypeFor(entry.routePath),
                        'cache-control': 'public, max-age=0, must-revalidate',
                    },
                });
            };
            console.log(`[scripts] GET    ${entry.routePath}  ←  ${entry.root}/${entry.rel}`);
        }
    }
    return ctx.routes;
}

async function buildScript(abs: string, fileName: string) {
    const ext = fileName.endsWith('.css') ? '.css' : '.js';
    const key = abs.replace(/[^a-zA-Z0-9]+/g, '_');
    const outdir = '.hyper/_runtime/scripts';
    await Bun.write(outdir + '/.keep', '');
    const out = await Bun.build({
        entrypoints: [abs],
        outdir,
        naming: key + ext,
        target: 'browser',
        format: ext === '.css' ? 'esm' : 'iife',
        minify: true,
        sourcemap: 'none',
    });
    if (!out.success) {
        const err = out.logs.map((log) => log.message).join('\n') || 'bundle failed';
        throw new Error(err);
    }
    const first = out.outputs[0];
    if (!first) throw new Error('bundle produced no outputs');
    return first.path;
}

function contentTypeFor(path: string) {
    if (path.endsWith('.css')) return 'text/css; charset=utf-8';
    return 'application/javascript; charset=utf-8';
}
