export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { provider: string; field: "access" | "refresh"; value: string },
): Promise<string> {
    const raw = await ctx.fns.llm.oauthEncryptionKey({});
    const keyBytes = Uint8Array.from(raw);
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(`hyper-code2/oauth-credential/v1/${opts.provider}/${opts.field}`);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, new TextEncoder().encode(opts.value));
    return JSON.stringify({ v: 1, iv: Buffer.from(iv).toString("base64url"), data: Buffer.from(ciphertext).toString("base64url") });
}
