type GetStringOpts = {
    /** Setting namespace. */
    module: string;
    /** Scope category. */
    scopeType: string;
    /** Optional scope identifier. */
    scopeId?: string | null;
    /** Setting key. */
    key: string;
    /** Value returned when the setting is absent. */
    fallback?: string;
};

/** Resolves a setting and coerces it to a string. */
export default async function (ctx: Context, _session: Session | null, opts: GetStringOpts): Promise<string | undefined> {
    const value = await ctx.fns.settings.get(opts);
    if (typeof value === 'string') return value;
    return opts.fallback;
}
