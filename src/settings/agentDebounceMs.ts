export default function (ctx: Context, _session: Session | null, opts: { agentId: string; fallback?: number }): number {
    const fallback = opts.fallback ?? 5000;
    return ctx.fns.settings?.getNumber?.({
        module: 'ui',
        scopeType: 'agent',
        scopeId: opts.agentId,
        key: 'debounceMs',
        fallback,
    }) ?? fallback;
}
