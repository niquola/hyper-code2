/**
 * Encrypt a local runtime secret with authenticated namespace binding
 *
 * Encrypts a secret value for durable local storage using the installation master key. Use only before persisting a runtime credential in local_secrets.
 * @param opts.namespace Stable namespace that cryptographically binds the envelope.
 * @param opts.name Stable secret name that cryptographically binds the envelope.
 * @param opts.value Plain-text secret value to encrypt.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Stable namespace that cryptographically binds the envelope. */
        namespace: string;
        /** Stable secret name that cryptographically binds the envelope. */
        name: string;
        /** Plain-text secret value to encrypt. */
        value: string;
    },
): Promise<string> {
    const namespace = String(opts.namespace ?? "").trim();
        const name = String(opts.name ?? "").trim();
        if (!namespace || !name) throw new Error("local secret namespace and name are required");
        const raw = await ctx.fns.llm.oauthEncryptionKey({});
        const key = await crypto.subtle.importKey("raw", Uint8Array.from(raw), "AES-GCM", false, ["encrypt"]);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const aad = new TextEncoder().encode(`hyper-code2/local-secret/v1/${namespace}/${name}`);
        const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, new TextEncoder().encode(opts.value));
        return JSON.stringify({ v: 1, iv: Buffer.from(iv).toString("base64url"), data: Buffer.from(data).toString("base64url") });
}
