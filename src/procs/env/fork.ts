// Fork a coexisting environment from the live ctx — same code, isolated world.
// Returns a derived ctx that SHARES the function registry and routes (the
// injecting Proxy reads `this.state.registry`, which we carry over) but has its
// OWN env (mode) and OWN state, so its db connection / events / caches don't
// touch the parent's. This is what lets a test env live next to dev in one REPL:
//   const t = ctx.fns.procs.env.fork({ mode: "test" });
//   await t.fns.db.connect({});               // test db, separate from dev's
//   const res = await t.fns.http.dispatch({ url: "/issues" });
/**
 * Perform fork for the env subsystem.
 * @param opts.mode The operating mode.
 * @param opts.env Environment variables for the operation.
 */
export default function (ctx: Context, _session: Session | null, opts?: { mode?: "test" | "dev" | "prod"; env?: Record<string, string | undefined> }): Context {
    const mode = opts?.mode ?? "test";
    const NODE_ENV = mode === "prod" ? "production" : mode === "test" ? "test" : "development";
    const c: any = Object.create(ctx);
    c.env = { ...ctx.env, NODE_ENV, ...(opts?.env ?? {}) };
    // Shared framework metadata (code & schemas & the file-tree discovery —
    // registry, root, middleware, migrations, hooks: all immutable or
    // rewritten-wholesale), but FRESH app state (db connection, events, caches)
    // — so a fork is isolated where it matters yet still runs middleware,
    // migrations and resolves its root like the parent.
    c.state = {
        registry: ctx.state.registry,
        serverStart: ctx.state.serverStart,
        root: ctx.state.root,
        // The framework's own state: what was read off the tree is shared (it is
        // the same code), what a fork may change is copied.
        procs: {
            boot: ctx.state.procs.boot,
            config: ctx.state.procs.config,
            migrate: ctx.state.procs.migrate,
            hooks: ctx.state.procs.hooks,
            modules: ctx.state.procs.modules,
            project: ctx.state.procs.project,
            // The route map is copied, not shared: a fork adding or removing a
            // route must not leak into the parent (handlers are shared, the map
            // is not).
            http: { ...ctx.state.procs.http, routes: { ...ctx.state.procs.http.routes } },
        },
    };
    c.session = null;
    return c as Context;
}
