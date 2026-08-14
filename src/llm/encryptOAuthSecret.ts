/** Performs the llm.encryptOAuthSecret runtime operation. */
/**
 * Encrypt an OAuth credential field for storage.
 * @param opts.provider OAuth provider identifier.
 * @param opts.field Credential field being encrypted or decrypted.
 * @param opts.value Plain-text credential value.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Model provider name. */ provider: string;
        /** Value used for the field option. */ field: "access" | "refresh";
        /** Setting value. */ value: string },
): Promise<string> {
    const raw = await ctx.fns.llm.oauthEncryptionKey({});
    const keyBytes = Uint8Array.from(raw);
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(`hyper-code2/oauth-credential/v1/${opts.provider}/${opts.field}`);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, new TextEncoder().encode(opts.value));
    return JSON.stringify({ v: 1, iv: Buffer.from(iv).toString("base64url"), data: Buffer.from(ciphertext).toString("base64url") });
}
