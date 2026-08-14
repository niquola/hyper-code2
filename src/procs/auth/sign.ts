// Mint a token for a person. The name travels in it — the UI greets them with
// it, a transcript can say who is talking, an audit line has something to write
// down — so a token without a name is an anonymous key, which is not what a
// session is for.
//
// Two lifetimes, because there are two kinds of token: `seconds` for one that
// only has to survive a single redirect, `days` (or the module default) for a
// session. And two optional claims, which are what make single-purpose tokens
// safe to sign with the same key: `kind` says what this token may be used for,
// and `jti` gives it an identity the issuer can spend exactly once.
//
// `iss` names the process that signed it, so a host that trusts another one can
// tell whose key answered.
/**
 * Perform sign for the auth subsystem.
 * @param opts.sub The sub value used by the operation.
 * @param opts.name The target name.
 * @param opts.email The email value used by the operation.
 * @param opts.role The role value used by the operation.
 * @param opts.days The days value used by the operation.
 * @param opts.seconds The seconds value used by the operation.
 * @param opts.kind The kind value used by the operation.
 * @param opts.jti The jti value used by the operation.
 * @param opts.iss The iss value used by the operation.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { sub: string; name: string; email?: string; role?: string; days?: number; seconds?: number; kind?: string; jti?: string; iss?: string },
): Promise<string> {
    const { privateKey } = await ctx.fns.procs.auth.keys({});
    const now = Math.floor(Date.now() / 1000);
    const ttl = opts.seconds ?? (opts.days ?? ctx.fns.procs.config.resolve({ module: "procs/auth" }).days) * 86400;

    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
        sub: opts.sub, name: opts.name, email: opts.email, role: opts.role,
        kind: opts.kind, jti: opts.jti,
        iss: opts.iss ?? "procs", iat: now, exp: now + ttl,
    };
    const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(body));
    return `${body}.${b64url(new Uint8Array(signature))}`;
}

function b64url(input: string | Uint8Array): string {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
    return Buffer.from(bytes).toString("base64url");
}
