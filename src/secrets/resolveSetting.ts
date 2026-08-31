// Resolve a secret-valued setting. The setting may contain an env:// or op://
// reference; legacy literal values are accepted during migration.
/**
 * Reads a secret-valued setting and resolves its provider reference.
 * @param opts.module Module that declares the setting.
 * @param opts.scopeType Setting scope type; defaults to global.
 * @param opts.scopeId Optional identifier within the selected scope.
 * @param opts.key Setting key to resolve.
 */
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
    return ctx.fns.secrets.get({ ref: value });
}
