export default function (ctx: Context, opts: { agentId: string; fallback?: number }): number {
    const fallback = opts.fallback ?? 5000;
    return ctx.fns.settings?.getNumber?.(ctx, {
        module: 'ui',
        scopeType: 'agent',
        scopeId: opts.agentId,
        key: 'debounceMs',
        fallback,
    }) ?? fallback;
}
