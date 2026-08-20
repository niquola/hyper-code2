/** Returns the configured tunnel password or password hash. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string | null> {
    const value = await ctx.fns.settings.getString({ module: "auth", scopeType: "global", key: "password" });
    return value?.trim() || null;
}
