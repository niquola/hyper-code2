// What the uniskill runtime offers: its mounted namespaces and their fns, read
// live over the bridge — so an agent can discover before calling.
//   ctx.fns.uni.skills({})            → { docs: ["search", "save", …], … }
//   ctx.fns.uni.skills({ ns: "docs" })→ ["search", "save", …]
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { ns?: string },
): Promise<any> {
    const code = opts.ns
        ? `Object.keys(ctx.fns[${JSON.stringify(opts.ns)}] ?? {}).sort()`
        : `Object.fromEntries(Object.entries(ctx.fns).map(([ns, fns]) => [ns, Object.keys(fns).sort()]))`;
    const r = await ctx.fns.uni.eval({ code });
    return r.return;
}
