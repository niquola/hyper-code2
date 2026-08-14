// Pick a value for the current environment. A lightweight way to vary a value
// (an endpoint, a flag) by env — a config fn is just a function:
//   export default (ctx) => ctx.fns.procs.env.pick({
//     test: "postgres://…/test", dev: "postgres://…/dev", prod: ctx.env.DATABASE_URL,
//   });
// (Module config proper goes through $config.ts + config.resolve — see db/url.ts.)
// If this env isn't given, falls back to dev, then prod (never to test).
// Returns any: config values are heterogeneous and the caller knows the type.
/**
 * Perform pick for the env subsystem.
 * @param opts.prod The prod value used by the operation.
 * @param opts.dev The dev value used by the operation.
 * @param opts.test The test value used by the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: { prod?: any; dev?: any; test?: any }): any {
    const mode = ctx.fns.procs.env.mode();
    const v = opts[mode];
    return v !== undefined ? v : opts.dev !== undefined ? opts.dev : opts.prod;
}
