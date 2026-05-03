export default function (ctx: Context, opts: { provider: string; envKey: string }): string | null {
    const fromSettings = ctx.fns.settings?.get(ctx, {
        module: 'provider',
        scopeType: 'provider',
        scopeId: opts.provider,
        key: 'apiKey',
    });
    if (typeof fromSettings === 'string' && fromSettings) return fromSettings;
    return ctx.env[opts.envKey] ?? null;
}
