// Cross-process single-flight refresh. Bun.SQL's reserved connection keeps the
// row lock and token request in one transaction.
/** Returns a fresh Anthropic OAuth access token for one credential slot. */
/**
 * Fetch a valid Anthropic OAuth access token, refreshing it when expired.
 * @param opts.account Credential slot within the provider; "default" is the single-login case.
 */
export default async function (ctx: Context, _session: Session | null, opts?: {
    /** Credential slot within the provider. @default "default" */ account?: string }): Promise<string> {
    const pool: any = await ctx.fns.procs.db.conn();
    const provider = "anthropic-oauth";
    const account = String(opts?.account ?? "").trim() || "default";
    try {
        return await pool.begin(async (tx: any) => {
            const rows: any[] = Array.from(await tx.unsafe(
                "SELECT access_enc, refresh_enc, expires_at FROM oauth_credentials WHERE provider = $1 AND account = $2 FOR UPDATE", [provider, account],
            ));
            const row = rows[0];
            if (!row) throw new Error(`Anthropic OAuth is not connected for account "${account}"; connect it in LLM settings`);
            if (Number(row.expires_at) > Date.now()) {
                return await ctx.fns.llm.decryptOAuthSecret({ provider, field: "access", envelope: row.access_enc });
            }
            const oldRefresh = await ctx.fns.llm.decryptOAuthSecret({ provider, field: "refresh", envelope: row.refresh_enc });
            const token = await ctx.fns.llm.exchangeAnthropicOAuth({ grant: "refresh_token", refreshToken: oldRefresh });
            const refresh = token.refresh ?? oldRefresh;
            const [accessEnc, refreshEnc] = await Promise.all([
                ctx.fns.llm.encryptOAuthSecret({ provider, field: "access", value: token.access }),
                ctx.fns.llm.encryptOAuthSecret({ provider, field: "refresh", value: refresh }),
            ]);
            await tx.unsafe(`UPDATE oauth_credentials SET access_enc=$1, refresh_enc=$2, expires_at=$3,
                scopes=COALESCE($4, scopes), version=version+1, updated_at=$5 WHERE provider=$6 AND account=$7`,
                [accessEnc, refreshEnc, token.expiresAt, token.scopes, Date.now(), provider, account]);
            return token.access;
        });
    } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.startsWith("Anthropic OAuth ")) throw e;
        throw new Error("Anthropic OAuth refresh failed; reconnect in LLM settings");
    }
}
