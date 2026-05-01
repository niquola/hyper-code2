type GetStringOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
    fallback?: string;
};

export default function (ctx: Context, opts: GetStringOpts): string | undefined {
    const value = ctx.fns.settings.get(ctx, opts);
    if (typeof value === 'string') return value;
    return opts.fallback;
}
