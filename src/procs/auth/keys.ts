// The workspace's own signing key. Generated on first use and kept in the
// project's .runtime/auth-key.json (0600), so the magic link printed at boot
// survives a restart — logging everyone out because the process bounced is not security,
// it is an interruption.
//
// RS256 because that is what a manager will hand us later: one verify path,
// two possible keys.
import { chmod, mkdir, writeFile } from "node:fs/promises";

const ALG = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" } as const;

/**
 * Perform keys for the auth subsystem.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; jwk: Awaited<ReturnType<typeof crypto.subtle.exportKey>> }> {
    const cached = (ctx.state.procs.auth ??= {}).keys;
    if (cached) return cached;
    const FILE = `${ctx.fns.procs.project.runtimeDir({})}/auth-key.json`;

    const load = async () => {
        const saved = await Bun.file(FILE).json().catch(() => null);
        if (!saved) return null;
        const keys = {
            privateKey: await crypto.subtle.importKey("jwk", saved.private, ALG, false, ["sign"]),
            publicKey: await crypto.subtle.importKey("jwk", saved.public, ALG, true, ["verify"]),
            jwk: saved.public,
        };
        (ctx.state.procs.auth ??= {}).keys = keys;
        return keys;
    };

    const onDisk = await load();
    if (onDisk) return onDisk;

    const pair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    // The FILE is the truth, and it is claimed rather than written: two runs over
    // one WORKDIR both find nothing here, both generate, and a plain write lets
    // the later one win the file while the earlier keeps its own key in memory.
    // Everything that verifies by reading the file — the REPL token a helper
    // presents, a session cookie from before the restart — then fails against a
    // process that is signing with something else. `wx` makes the claim atomic:
    // whoever loses it imports the key that is there and throws its own away.
    try {
        // `Bun.write` made the directory on the way; an exclusive open does not.
        await mkdir(ctx.fns.procs.project.runtimeDir({}), { recursive: true });
        await writeFile(FILE, JSON.stringify({ private: await crypto.subtle.exportKey("jwk", pair.privateKey), public: jwk }), { flag: "wx", mode: 0o600 });
    } catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        const theirs = await load();
        if (theirs) return theirs;
        throw error;
    }
    await chmod(FILE, 0o600).catch(() => { /* an fs without modes */ });

    const keys = { privateKey: pair.privateKey, publicKey: pair.publicKey, jwk };
    (ctx.state.procs.auth ??= {}).keys = keys;
    return keys;
}
