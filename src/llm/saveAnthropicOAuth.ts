/** Performs the llm.saveAnthropicOAuth runtime operation. */
/**
 * Encrypt and persist Anthropic OAuth credentials.
 * @param opts.access OAuth access token.
 * @param opts.refresh OAuth refresh token.
 * @param opts.expiresAt Access-token expiration time as a Unix timestamp in milliseconds.
 * @param opts.scopes Granted OAuth scopes.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Value used for the access option. */ access: string;
        /** Value used for the refresh option. */ refresh: string;
        /** Token expiration time. */ expiresAt: number;
        /** Value used for the scopes option. */ scopes?: string | null },
): Promise<{ ok: true }> {
    const provider = "anthropic-oauth";
    const [accessEnc, refreshEnc] = await Promise.all([
        ctx.fns.llm.encryptOAuthSecret({ provider, field: "access", value: opts.access }),
        ctx.fns.llm.encryptOAuthSecret({ provider, field: "refresh", value: opts.refresh }),
    ]);
    const now = Date.now();
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO oauth_credentials
            (provider, access_enc, refresh_enc, expires_at, scopes, metadata, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, '{}', 1, ?, ?)
            ON CONFLICT(provider) DO UPDATE SET access_enc=excluded.access_enc,
              refresh_enc=excluded.refresh_enc, expires_at=excluded.expires_at,
              scopes=excluded.scopes, version=oauth_credentials.version+1, updated_at=excluded.updated_at`,
        params: [provider, accessEnc, refreshEnc, opts.expiresAt, opts.scopes ?? null, now, now],
    });
    return { ok: true };
}
