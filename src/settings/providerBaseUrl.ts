export default function (ctx: Context, provider: string, fallback: string): string {
    return ctx.fns.settings?.getString?.(ctx, {
        module: 'provider',
        scopeType: 'provider',
        scopeId: provider,
        key: 'baseUrl',
        fallback,
    }) ?? fallback;
}
