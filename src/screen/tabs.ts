// Which tabs exist and which one the open page is showing — apps first, then
// the plugins, the same strip the layout renders.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const tabs = ["apps", ...(ctx.state.procs.modules ?? []).map(p => (p.namespaces[0] ?? p.name))];
    const path = await ctx.fns.screen.eval({ code: "return location.pathname" }).catch(() => null);
    return { tabs, current: tabs.find(t => path === `/${t}` || String(path).startsWith(`/${t}/`)) ?? null };
}
