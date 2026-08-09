// Register a hook under a name (id dedups / lets a later module override).
// Usually done declaratively via a $hook_<name>.ts file; this is the
// programmatic form (e.g. from a module's $start).
export default function (ctx: Context, _session: Session | null, opts: { name: string; id: string; fn: Function }) {
    const handlers = ((ctx.state.procs.hooks ??= {}).handlers ??= {});
    (handlers[opts.name] ??= new Map()).set(opts.id, opts.fn);
    return { registered: opts.name, id: opts.id };
}
