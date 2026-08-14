import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// The encryption key never lives in Postgres. Production can inject a stable
// base64 key; local installs get a permission-restricted key file.
/** Performs the llm.oauthEncryptionKey runtime operation. */
/**
 * Load and validate the OAuth credential encryption key.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Uint8Array> {
    const configured = ctx.env.HYPER_OAUTH_ENCRYPTION_KEY;
    if (configured) return decodeKey(configured);

    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    if (!home) throw new Error("OAuth encryption key is unavailable");
    const path = ctx.env.HYPER_OAUTH_KEY_FILE ?? `${home}/.hyper-code2/oauth.key`;
    try { return decodeKey(readFileSync(path, "utf8").trim()); } catch { /* create below */ }

    const key = crypto.getRandomValues(new Uint8Array(32));
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, Buffer.from(key).toString("base64url"), { mode: 0o600, flag: "wx" });
    chmodSync(path, 0o600);
    return key;
}

function decodeKey(value: string): Uint8Array {
    let bytes: Buffer;
    try { bytes = Buffer.from(value, value.includes("-") || value.includes("_") ? "base64url" : "base64"); }
    catch { throw new Error("OAuth encryption key is invalid"); }
    if (bytes.length !== 32) throw new Error("OAuth encryption key must decode to 32 bytes");
    return new Uint8Array(bytes);
}
