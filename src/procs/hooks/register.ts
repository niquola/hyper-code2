// Register a hook under a name (id dedups / lets a later module override).
// Usually done declaratively via a $hook_<name>.ts file; this is the
// programmatic form (e.g. from a module's $start).
/**
 * Perform register for the hooks subsystem.
 * @param opts.name The target name.
 * @param opts.id The target identifier.
 * @param opts.fn The fn value used by the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: { name: string; id: string; fn: Function }) {
    const handlers = ((ctx.state.procs.hooks ??= {}).handlers ??= {});
    (handlers[opts.name] ??= new Map()).set(opts.id, opts.fn);
    return { registered: opts.name, id: opts.id };
}
