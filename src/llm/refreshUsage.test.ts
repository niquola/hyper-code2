import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

const NOW = 1_786_900_000_000;

function jwt(payload: any): string {
    const enc = (value: any) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${enc({ alg: "none" })}.${enc(payload)}.`;
}

describe("llm.refreshUsage", () => {
    test("fetches Codex /wham/usage and persists both quota windows", async () => {
        const ctx: any = await mkTestCtx();
        ctx.state.registry.llm.refreshCodex = async () => jwt({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } });
        ctx.state.registry.llm.connectFetch = async (_c: any, _s: any, opts: any) => {
            expect(opts.url).toBe("https://chatgpt.com/backend-api/wham/usage");
            expect(opts.init.headers["chatgpt-account-id"]).toBe("acct-1");
            return new Response(JSON.stringify({
                plan_type: "pro",
                rate_limit: {
                    primary_window: { used_percent: 42, limit_window_seconds: 18_000, reset_at: Math.floor((NOW + 3_600_000) / 1000) },
                    secondary_window: { used_percent: 17, limit_window_seconds: 604_800, reset_after_seconds: 86_400 },
                },
            }), { status: 200, headers: { "content-type": "application/json" } });
        };

        const result = await ctx.fns.llm.refreshUsage({ accounts: [{ provider: "codex", account: "work" }], maxAgeMs: 0, now: NOW });
        expect(result).toEqual([{ provider: "codex", account: "work", status: "refreshed", error: null }]);
        const usage = await ctx.fns.llm.usageOverview({ now: NOW });
        expect(usage[0]).toMatchObject({ provider: "codex", account: "work", usedPercent: 42, planType: "pro" });
    });

    test("fetches Claude OAuth usage and converts percentages for recordUsage", async () => {
        const ctx: any = await mkTestCtx();
        ctx.state.registry.llm.getAnthropicOAuthToken = async () => "oauth-token";
        ctx.state.registry.llm.connectFetch = async (_c: any, _s: any, opts: any) => {
            if (opts.url === "https://api.anthropic.com/api/oauth/profile") {
                return new Response(JSON.stringify({ organization: { organization_type: "claude_max" } }), { status: 200 });
            }
            expect(opts.url).toBe("https://api.anthropic.com/api/oauth/usage");
            return new Response(JSON.stringify({
                five_hour: { utilization: 63.5, resets_at: new Date(NOW + 2_000_000).toISOString() },
                seven_day: { utilization: 28, resets_at: new Date(NOW + 5 * 86_400_000).toISOString() },
            }), { status: 200, headers: { "content-type": "application/json" } });
        };

        const result = await ctx.fns.llm.refreshUsage({ accounts: [{ provider: "anthropic-oauth", account: "pro" }], maxAgeMs: 0, now: NOW });
        expect(result[0]?.status).toBe("refreshed");
        const usage = await ctx.fns.llm.usageOverview({ now: NOW });
        expect(usage[0]).toMatchObject({ provider: "anthropic-oauth", account: "pro", usedPercent: 63.5, planType: "max" });
    });

    test("caches successful refreshes and isolates provider failures", async () => {
        const ctx: any = await mkTestCtx();
        let calls = 0;
        ctx.state.registry.llm.refreshCodex = async () => "token";
        ctx.state.registry.llm.connectFetch = async () => { calls++; throw new Error("Bearer secret provider down"); };
        const failed = await ctx.fns.llm.refreshUsage({ accounts: [{ provider: "codex", account: "bad" }, { provider: "kimi-coding", account: "default" }], now: NOW });
        expect(failed).toEqual([
            { provider: "codex", account: "bad", status: "failed", error: "Bearer [redacted] provider down" },
            { provider: "kimi-coding", account: "default", status: "unsupported", error: null },
        ]);
        expect(calls).toBe(1);
    });
});
