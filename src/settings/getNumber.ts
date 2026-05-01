type GetNumberOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
    fallback?: number;
};

export default function (ctx: Context, opts: GetNumberOpts): number | undefined {
    const value = ctx.fns.settings.get(ctx, opts);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return opts.fallback;
}
