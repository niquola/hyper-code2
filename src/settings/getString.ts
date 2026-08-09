type GetStringOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
    fallback?: string;
};

export default function (ctx: Context, _session: Session | null, opts: GetStringOpts): string | undefined {
    const value = ctx.fns.settings.get(opts);
    if (typeof value === 'string') return value;
    return opts.fallback;
}
