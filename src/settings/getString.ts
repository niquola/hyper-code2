type GetStringOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
    fallback?: string;
};

export default async function (ctx: Context, _session: Session | null, opts: GetStringOpts): Promise<string | undefined> {
    const value = await ctx.fns.settings.get(opts);
    if (typeof value === 'string') return value;
    return opts.fallback;
}
