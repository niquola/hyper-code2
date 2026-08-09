export default async function (ctx: Context, _session: Session | null, opts: { agentId: string; fallback?: number }): Promise<number> {
    const fallback = opts.fallback ?? 5000;
    return (await ctx.fns.settings?.getNumber?.({
        module: 'ui',
        scopeType: 'agent',
        scopeId: opts.agentId,
        key: 'debounceMs',
        fallback,
    })) ?? fallback;
}
