type GetStringOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
    fallback: string;
};

export default function (ctx: Context, opts: GetStringOpts): string {
    const value = ctx.fns.settings.get(ctx, opts);
    return typeof value === 'string' ? value : opts.fallback;
}
