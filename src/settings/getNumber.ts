type GetNumberOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
    fallback?: number;
};

export default async function (ctx: Context, _session: Session | null, opts: GetNumberOpts): Promise<number | undefined> {
    const value = await ctx.fns.settings.get(opts);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return opts.fallback;
}
