/**
 * Decrypt one authenticated local runtime secret envelope
 *
 * Decrypts a local_secrets envelope using its namespace and name as authenticated data. Use when reading durable runtime credentials.
 * @param opts.namespace Namespace used when the envelope was encrypted.
 * @param opts.name Secret name used when the envelope was encrypted.
 * @param opts.envelope Encrypted JSON envelope from local_secrets.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Namespace used when the envelope was encrypted. */
        namespace: string;
        /** Secret name used when the envelope was encrypted. */
        name: string;
        /** Encrypted JSON envelope from local_secrets. */
        envelope: string;
    },
): Promise<string> {
    let parsed: any;
        try { parsed = JSON.parse(opts.envelope); } catch { throw new Error("local secret cannot be decrypted"); }
        if (parsed?.v !== 1 || !parsed.iv || !parsed.data) throw new Error("local secret cannot be decrypted");
        try {
            const raw = await ctx.fns.llm.oauthEncryptionKey({});
            const key = await crypto.subtle.importKey("raw", Uint8Array.from(raw), "AES-GCM", false, ["decrypt"]);
            const aad = new TextEncoder().encode(`hyper-code2/local-secret/v1/${String(opts.namespace).trim()}/${String(opts.name).trim()}`);
            const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(parsed.iv, "base64url"), additionalData: aad }, key, Buffer.from(parsed.data, "base64url"));
            return new TextDecoder().decode(plain);
        } catch { throw new Error("local secret cannot be decrypted"); }
}
