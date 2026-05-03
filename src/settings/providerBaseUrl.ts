export default function (ctx: Context, opts: { provider: string; fallback: string }): string {
    return ctx.fns.settings?.getString?.(ctx, {
        module: 'provider',
        scopeType: 'provider',
        scopeId: opts.provider,
        key: 'baseUrl',
        fallback: opts.fallback,
    }) ?? opts.fallback;
}
