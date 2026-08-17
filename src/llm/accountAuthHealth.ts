/**
 * Reads or updates durable secret-free authentication health for one provider account
 *
 * Store and retrieve whether a subscription account requires reconnection after an authentication failure. Use mark on provider 401 responses, clear after successful login or token refresh, and list/get when presenting account availability. Only provider, account, state, and timestamps are persisted; credentials and response bodies are never stored.
 * @param opts.action Health operation to perform.
 * @param opts.provider Provider route name; required for get, mark, and clear.
 * @param opts.account Credential account name; defaults to default for get, mark, and clear. @default default
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Health operation to perform. */
        action: "get" | "list" | "mark" | "clear";
        /** Provider route name; required for get, mark, and clear. */
        provider?: string;
        /** Credential account name; defaults to default for get, mark, and clear. @default default */
        account?: string;
    },
): Promise<Array<{ provider: string; account: string; needsReconnect: boolean; updatedAt: number }>> {
    const key = "llm:account-auth-health";
    const row = ((await ctx.fns.procs.db.select({ sql: "SELECT value FROM kv WHERE key = ?", params: [key] })) as any[])[0];
    let entries: Array<{ provider: string; account: string; needsReconnect: boolean; updatedAt: number }> = [];
    try { entries = row ? JSON.parse(String(row.value)) : []; } catch { entries = []; }
    if (opts.action === "list") return entries;
    const provider = String(opts.provider ?? "").trim();
    if (!provider) throw new Error("provider is required");
    const account = String(opts.account ?? "").trim() || "default";
    const index = entries.findIndex(item => item.provider === provider && item.account === account);
    if (opts.action === "get") return index >= 0 ? [entries[index]!] : [];
    if (opts.action === "clear") {
        if (index >= 0) entries.splice(index, 1);
    } else {
        const next = { provider, account, needsReconnect: true, updatedAt: Date.now() };
        if (index >= 0) entries[index] = next; else entries.push(next);
    }
    await ctx.fns.procs.db.run({ sql: "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", params: [key, JSON.stringify(entries)] });
    return entries;
}
