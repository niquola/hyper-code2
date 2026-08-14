export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{
    connected: boolean; expiresAt: number | null; needsReconnect: boolean;
    loginStatus: "idle" | "pending" | "exchanging" | "failed"; error: string | null;
}> {
    const rows = await ctx.fns.procs.db.select({
        sql: "SELECT expires_at FROM oauth_credentials WHERE provider = ?", params: ["anthropic-oauth"],
    }) as any[];
    const store: any = (ctx.state as any).llm?.anthropicOAuth;
    const active = [...(store?.pending?.values?.() ?? [])].find((p: any) => p.expiresAt > Date.now() && (p.status === "pending" || p.status === "exchanging"));
    const expiresAt = rows.length ? Number(rows[0].expires_at) : null;
    return {
        connected: rows.length > 0,
        expiresAt,
        needsReconnect: rows.length > 0 && Number(expiresAt) <= Date.now(),
        loginStatus: active?.status ?? (store?.lastError ? "failed" : "idle"),
        error: store?.lastError ?? null,
    };
}
