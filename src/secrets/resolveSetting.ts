// Resolve a secret-valued setting. The setting may contain an env:// or op://
// reference; legacy literal values are accepted during migration.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { module: string; scopeType?: string; scopeId?: string | null; key: string },
): Promise<string | null> {
    const value = await ctx.fns.settings.get({
        module: opts.module,
        scopeType: opts.scopeType ?? "global",
        scopeId: opts.scopeId,
        key: opts.key,
    });
    if (value == null) return null;
    if (typeof value !== "string") throw new Error("secret setting must be a string reference");
    return ctx.fns.secrets.resolve({ ref: value });
}
