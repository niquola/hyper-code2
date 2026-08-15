/** Returns the configured embeddings provider, or `off`. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string> {
    return (await ctx.fns.settings.getString({
        module: "embeddings", scopeType: "global", key: "provider", fallback: "off",
    })) || "off";
}
