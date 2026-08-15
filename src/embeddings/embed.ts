/** Embeds one or more texts through the configured provider. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Text or texts to embed. */
        input: string | string[];
        /** Optional provider-specific model override. */
        model?: string;
    },
): Promise<{ provider: string; model: string; dimensions: number; vectors: number[][] }> {
    const provider = await ctx.fns.embeddings.provider({});
    if (provider === "off") throw new Error("embeddings are disabled; set embeddings.provider");
    if (provider === "openai") return ctx.fns.embeddings.openai({ input: opts.input, model: opts.model });
    throw new Error(`unsupported embeddings provider: ${provider}`);
}
