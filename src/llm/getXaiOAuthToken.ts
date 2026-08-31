/**
 * Return a valid xAI subscription access token for one account.
 *
 * Decrypts a fresh token or refreshes an expired token while holding the OAuth
 * row lock, preventing concurrent workers from rotating the same refresh token.
 *
 * @param opts.account Named xAI credential slot selected by xai/account:model. @default "default"
 */
export default async function (ctx: Context, _session: Session | null, opts?: {
    /** Named xAI credential slot selected by the model route. @default "default" */ account?: string;
}): Promise<string> {
    const provider = "xai-oauth", account = String(opts?.account ?? "").trim() || "default";
    const pool: any = await ctx.fns.procs.db.conn();
    try { return await pool.begin(async (tx: any) => {
        const rows: any[] = Array.from(await tx.unsafe("SELECT access_enc,refresh_enc,expires_at FROM oauth_credentials WHERE provider=$1 AND account=$2 FOR UPDATE", [provider, account]));
        const row = rows[0];
        if (!row) throw new Error(`xAI OAuth is not connected for account "${account}"`);
        if (Number(row.expires_at) > Date.now()) return ctx.fns.llm.decryptOAuthSecret({ provider, field: "access", envelope: row.access_enc });
        const oldRefresh = await ctx.fns.llm.decryptOAuthSecret({ provider, field: "refresh", envelope: row.refresh_enc });
        const token = await ctx.fns.llm.exchangeXaiOAuth({ grant: "refresh_token", refreshToken: oldRefresh });
        const [accessEnc, refreshEnc] = await Promise.all([ctx.fns.llm.encryptOAuthSecret({ provider, field: "access", value: token.access }), ctx.fns.llm.encryptOAuthSecret({ provider, field: "refresh", value: token.refresh })]);
        await tx.unsafe("UPDATE oauth_credentials SET access_enc=$1,refresh_enc=$2,expires_at=$3,scopes=COALESCE($4,scopes),version=version+1,updated_at=$5 WHERE provider=$6 AND account=$7", [accessEnc, refreshEnc, token.expiresAt, token.scopes, Date.now(), provider, account]);
        return token.access;
    }); } catch (e: any) { if (String(e?.message).startsWith("xAI OAuth ")) throw e; throw new Error("xAI OAuth refresh failed; reconnect"); }
}
