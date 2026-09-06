/**
 * Consumes one Codex rate-limit reset credit
 *
 * Redeem one available Codex reset credit for a configured account, refresh quota state, and return the backend outcome. Use only after explicit user confirmation because a successful call spends a finite credit.
 * @param opts.account Configured Codex credential account. @default default
 * @param opts.creditId Specific opaque reset credit id; omit to let Codex choose.
 * @param opts.idempotencyKey Stable key reused when retrying the same redemption attempt.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Configured Codex credential account. @default default */
        account?: string;
        /** Specific opaque reset credit id; omit to let Codex choose. */
        creditId?: string;
        /** Stable key reused when retrying the same redemption attempt. */
        idempotencyKey?: string;
    },
): Promise<{ outcome: "reset" | "nothingToReset" | "noCredit" | "alreadyRedeemed"; windowsReset: number | null }> {
    const account = opts.account ?? "default";
    const token = await ctx.fns.llm.refreshCodex({ account });
    if (!token) throw new Error("Codex credential is unavailable");
    let accountId: string | undefined;
    try { accountId = JSON.parse(Buffer.from(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString())?.["https://api.openai.com/auth"]?.chatgpt_account_id; } catch {}
    const redeemRequestId = opts.idempotencyKey ?? crypto.randomUUID();
    const res = await ctx.fns.llm.connectFetch({ url: "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume", ms: 10_000, init: { method: "POST", headers: { authorization: `Bearer ${token}`, ...(accountId ? { "chatgpt-account-id": String(accountId) } : {}), "content-type": "application/json", "user-agent": "codex-cli" }, body: JSON.stringify({ redeem_request_id: redeemRequestId, ...(opts.creditId ? { credit_id: opts.creditId } : {}) }) } });
    if (!res.ok) throw new Error(`reset endpoint returned ${res.status}`);
    const data: any = await res.json();
    const raw = String(data?.code ?? data?.outcome ?? "").replace(/_([a-z])/g, (_: string, x: string) => x.toUpperCase());
    const outcome = raw === "reset" || raw === "nothingToReset" || raw === "noCredit" || raw === "alreadyRedeemed" ? raw : (() => { throw new Error("unknown reset outcome"); })();
    await ctx.fns.llm.refreshUsage({ provider: "codex", account, maxAgeMs: 0 });
    return { outcome, windowsReset: Number.isFinite(Number(data?.windows_reset)) ? Number(data.windows_reset) : null };
}
