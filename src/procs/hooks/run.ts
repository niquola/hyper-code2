// Run every hook registered under `name`, in registration order, each with the
// current ctx+session and `opts`. Returns the array of results. Use for
// fan-out extension points (on-request, collect-menu-items, …).
export default async function (ctx: Context, session: Session | null, opts: { name: string; opts?: any }) {
    warnIfUndeclared(ctx, opts.name);
    const map = ctx.state.procs?.hooks?.handlers?.[opts.name];
    if (!map) return [];
    const out: any[] = [];
    for (const fn of map.values()) out.push(await fn(ctx, session, opts.opts ?? {}));
    return out;
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
