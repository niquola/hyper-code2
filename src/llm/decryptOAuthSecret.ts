export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { provider: string; field: "access" | "refresh"; envelope: string },
): Promise<string> {
    let parsed: any;
    try { parsed = JSON.parse(opts.envelope); } catch { throw new Error("OAuth credential cannot be decrypted"); }
    if (parsed?.v !== 1 || !parsed.iv || !parsed.data) throw new Error("OAuth credential cannot be decrypted");
    try {
        const raw = await ctx.fns.llm.oauthEncryptionKey({});
        const keyBytes = Uint8Array.from(raw);
        const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
        const aad = new TextEncoder().encode(`hyper-code2/oauth-credential/v1/${opts.provider}/${opts.field}`);
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(parsed.iv, "base64url"), additionalData: aad }, key, Buffer.from(parsed.data, "base64url"));
        return new TextDecoder().decode(plain);
    } catch { throw new Error("OAuth credential cannot be decrypted"); }
}
