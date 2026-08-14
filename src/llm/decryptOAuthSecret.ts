/** Performs the llm.decryptOAuthSecret runtime operation. */
/**
 * Decrypt a stored OAuth credential field.
 * @param opts.provider OAuth provider identifier.
 * @param opts.field Credential field being encrypted or decrypted.
 * @param opts.envelope Encrypted credential envelope.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Model provider name. */ provider: string;
        /** Value used for the field option. */ field: "access" | "refresh";
        /** Value used for the envelope option. */ envelope: string },
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
