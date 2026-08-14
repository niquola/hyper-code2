// Run hooks under `name` until one returns a non-null result; return it (or
// undefined). Use for "first responder" points — authenticate, resolve-handler,
// where the first hook that handles it wins.
/**
 * Run hooks under `name` until the first responder returns a non-null result.
 * @param opts.name The hook point name.
 * @param opts.opts Options passed to each registered hook.
 */
export default async function (ctx: Context, session: Session | null, opts: { name: string; opts?: any }) {
    warnIfUndeclared(ctx, opts.name);
    const map = ctx.state.procs?.hooks?.handlers?.[opts.name];
    if (!map) return undefined;
    for (const fn of map.values()) {
        const r = await fn(ctx, session, opts.opts ?? {});
        if (r !== undefined && r !== null) return r;
    }
    return undefined;
}

// Running a point nobody declared is almost always a typo in the name; say so
// once rather than answering "nothing is registered" forever.
const warned = new Set<string>();
function warnIfUndeclared(ctx: Context, name: string): void {
    const points = ctx.state.procs?.hooks?.points ?? {};
    // A family covers everything under it: `services.service` declares
    // `services.service.aidbox` and any other provider that names itself.
    const covered = points[name] || Object.entries(points).some(([p, d]) => (d as any).family && name.startsWith(p + "."));
    if (covered || warned.has(name)) return;
    warned.add(name);
    console.warn(`[hooks] "${name}" is not declared by anyone — a module declares a point with $point_<name>.ts`);
}
