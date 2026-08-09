// Introspect: { hookName: [registered ids] }.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const points = ctx.state.procs?.hooks?.points ?? {};
    const handlers = ctx.state.procs?.hooks?.handlers ?? {};
    // Every point, whether or not anyone answers it — and any answers to a point
    // nobody declared, which is what a typo looks like.
    const names = [...new Set([...Object.keys(points), ...Object.keys(handlers)])].sort();
    return Object.fromEntries(names.map(name => [name, {
        declaredBy: points[name]?.module ?? null,
        answeredBy: [...(handlers[name]?.keys() ?? [])],
    }]));
}
