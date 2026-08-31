import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// The encryption key never lives in Postgres. Production can inject a stable
// base64 key. Local macOS installs store it in Login Keychain; the legacy
// permission-restricted file is imported once for compatibility.
/** Performs the llm.oauthEncryptionKey runtime operation. */
/**
 * Load and validate the OAuth credential encryption key.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Uint8Array> {
    const configured = ctx.env.HYPER_OAUTH_ENCRYPTION_KEY;
    if (configured) return decodeKey(configured);

    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    if (!home) throw new Error("OAuth encryption key is unavailable");
    const service = ctx.env.HYPER_OAUTH_KEYCHAIN_SERVICE ?? "hyper-code2/local-secret-store";
    const account = ctx.env.USER ?? process.env.USER ?? "local";
    if (process.platform === "darwin") {
        const existing = Bun.spawnSync(["security", "find-generic-password", "-s", service, "-a", account, "-w"], { stdout: "pipe", stderr: "ignore" });
        if (existing.exitCode === 0) return decodeKey(existing.stdout.toString().trim());
    }

    const path = ctx.env.HYPER_OAUTH_KEY_FILE ?? `${home}/.hyper-code2/oauth.key`;
    let encoded: string | null = null;
    try { encoded = readFileSync(path, "utf8").trim(); } catch { /* create below */ }
    if (!encoded) encoded = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

    if (process.platform === "darwin") {
        const saved = Bun.spawnSync(["security", "add-generic-password", "-U", "-s", service, "-a", account, "-w", encoded], { stdout: "ignore", stderr: "pipe" });
        if (saved.exitCode === 0) return decodeKey(encoded);
    }

    // Non-macOS and headless fallback. Production should set the env key.
    try {
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        writeFileSync(path, encoded, { mode: 0o600, flag: "wx" });
        chmodSync(path, 0o600);
    } catch {
        // Existing file won a concurrent create; load that exact key.
        try { return decodeKey(readFileSync(path, "utf8").trim()); } catch {}
    }
    return decodeKey(encoded);
}

function decodeKey(value: string): Uint8Array {
    let bytes: Buffer;
    try { bytes = Buffer.from(value, value.includes("-") || value.includes("_") ? "base64url" : "base64"); }
    catch { throw new Error("OAuth encryption key is invalid"); }
    if (bytes.length !== 32) throw new Error("OAuth encryption key must decode to 32 bytes");
    return new Uint8Array(bytes);
}
