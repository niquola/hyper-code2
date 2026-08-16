/** Reports connection state of every managed Anthropic OAuth account. */
/**
 * Report whether Anthropic OAuth credentials are configured.
 *
 * `accounts` lists every credential slot separately; the top-level fields
 * describe the whole provider and stay backwards compatible with the
 * single-account shape.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{
    connected: boolean; expiresAt: number | null; needsReconnect: boolean;
    loginStatus: "idle" | "pending" | "exchanging" | "failed"; error: string | null;
    accounts: Array<{ account: string; label: string | null; expiresAt: number; needsReconnect: boolean }>;
    pendingAccount: string | null;
}> {
    const rows = await ctx.fns.procs.db.select({
        sql: "SELECT account, label, expires_at FROM oauth_credentials WHERE provider = ? ORDER BY account = 'default' DESC, account",
        params: ["anthropic-oauth"],
    }) as any[];
    const store: any = (ctx.state as any).llm?.anthropicOAuth;
    const active = [...(store?.pending?.values?.() ?? [])].find((p: any) => p.expiresAt > Date.now() && (p.status === "pending" || p.status === "exchanging"));
    const now = Date.now();
    const accounts = rows.map((row: any) => ({
        account: String(row.account ?? "default"),
        label: row.label ? String(row.label) : null,
        expiresAt: Number(row.expires_at),
        needsReconnect: Number(row.expires_at) <= now,
    }));
    // The provider counts as connected while ANY account still works; a single
    // expired slot must not make the whole section look broken.
    const usable = accounts.filter((a) => !a.needsReconnect);
    return {
        connected: accounts.length > 0,
        expiresAt: accounts[0]?.expiresAt ?? null,
        needsReconnect: accounts.length > 0 && usable.length === 0,
        loginStatus: active?.status ?? (store?.lastError ? "failed" : "idle"),
        error: store?.lastError ?? null,
        accounts,
        pendingAccount: active?.account ?? null,
    };
}
