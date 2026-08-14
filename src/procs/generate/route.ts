// Scaffold a new route file, register it, broadcast reload.
//   ctx.fns.procs.generate.route({ module: "todo", method: "GET" })            → GET /todo
//   ctx.fns.procs.generate.route({ module: "todo", path: "$id", method: "GET" }) → GET /todo/:id
/**
 * Perform route for the generate subsystem.
 * @param opts.module The module value used by the operation.
 * @param opts.path The filesystem or route path.
 * @param opts.method The HTTP method.
 * @param opts.body The HTTP body.
 */
export default async function (ctx: Context, _session: Session | null, opts: { module: string; path?: string; method: string; body?: string }) {
    const { module: mod, path = "", method } = opts;
    const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);
    if (!METHODS.has(method)) throw new Error(`bad method: ${method}`);
    if (!/^[a-zA-Z_][\w/]*$/.test(mod)) throw new Error(`bad module: ${mod}`);

    const rel = `${mod}/$route_${path}_${method}.ts`;
    const abs = `${ctx.fns.procs.project.projectRoot({})}/src/${rel}`; // app src, not proc core
    if (await Bun.file(abs).exists()) throw new Error(`already exists: src/${rel}`);

    const routePath = '/' + [...mod.split('/'), ...path.split('_')].filter(Boolean)
        .map(s => s.startsWith('$') ? ':' + s.slice(1) : s).join('/');
    const body = opts.body ?? `    return { title: "${routePath}", main: \`<h1>${routePath}</h1>\` };`;
    const src = `export default async function (ctx: Context, session: Session, opts: { req: Request; params: Record<string, string> }) {\n${body}\n}\n`;
    await Bun.write(abs, src);
    console.log(`[generate] route src/${rel} → ${method} ${routePath}`);

    await ctx.fns.procs.http.loadRoutes({});
    ctx.fns.procs.events.reload({});
    return { created: `src/${rel}`, route: `${method} ${routePath}` };
}
