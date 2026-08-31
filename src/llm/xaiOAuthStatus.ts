/**
 * Report managed xAI accounts and safe device-login progress.
 *
 * Returns account metadata and public authorization fields only; encrypted
 * access tokens, refresh tokens and the private device code are never exposed.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{
    connected: boolean;
    needsReconnect: boolean;
    accounts: Array<{ account: string; label: string | null; expiresAt: number; needsReconnect: boolean }>;
    loginStatus: "pending" | "failed" | "idle";
    error: string | null;
    pending: { account: string; userCode: string; verificationUri: string; expiresAt: number; intervalSeconds: number } | null;
}> {
    const rows = await ctx.fns.procs.db.select({ sql: "SELECT account,label,expires_at FROM oauth_credentials WHERE provider=? ORDER BY account='default' DESC,account", params: ["xai-oauth"] }) as any[];
    const pending = [...((ctx.state as any).llm?.xaiOAuth?.pending?.values?.() ?? [])].find((p: any) => ["pending"].includes(p.status) && p.expiresAt > Date.now()) as any;
    const accounts = rows.map(r => ({ account: String(r.account), label: r.label ? String(r.label) : null, expiresAt: Number(r.expires_at), needsReconnect: Number(r.expires_at) <= Date.now() }));
    return { connected: accounts.length > 0, needsReconnect: accounts.length > 0 && accounts.every(a => a.needsReconnect), accounts,
        loginStatus: pending?.status ?? ((ctx.state as any).llm?.xaiOAuth?.lastError ? "failed" : "idle"), error: (ctx.state as any).llm?.xaiOAuth?.lastError ?? null,
        pending: pending ? { account: pending.account, userCode: pending.userCode, verificationUri: pending.verificationUri, expiresAt: pending.expiresAt, intervalSeconds: pending.intervalSeconds } : null };
}
