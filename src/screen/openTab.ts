// Switch the right pane to a tab — the same thing clicking it does.
export default async function (ctx: Context, _session: Session | null, opts: { plugin: string }) {
    const tabs = ["apps", ...(ctx.state.procs.modules ?? []).map(p => (p.namespaces[0] ?? p.name))];
    if (!tabs.includes(opts.plugin)) throw new Error(`no such tab: ${opts.plugin} (have ${tabs.join(", ")})`);
    await ctx.fns.screen.open({ url: `/${opts.plugin}` });
    return { tab: opts.plugin };
}
