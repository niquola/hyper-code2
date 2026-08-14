type GetNumberOpts = {
    /** Setting namespace. */
    module: string;
    /** Scope category. */
    scopeType: string;
    /** Optional scope identifier. */
    scopeId?: string | null;
    /** Setting key. */
    key: string;
    /** Value returned when the setting is absent or non-numeric. */
    fallback?: number;
};

/** Resolves a setting and coerces it to a number. */
export default async function (ctx: Context, _session: Session | null, opts: GetNumberOpts): Promise<number | undefined> {
    const value = await ctx.fns.settings.get(opts);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return opts.fallback;
}
