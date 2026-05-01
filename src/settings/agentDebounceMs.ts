export default function (ctx: Context, agentId: string, fallback = 5000): number {
    return ctx.fns.settings?.getNumber?.(ctx, {
        module: 'ui',
        scopeType: 'agent',
        scopeId: agentId,
        key: 'debounceMs',
        fallback,
    }) ?? fallback;
}
