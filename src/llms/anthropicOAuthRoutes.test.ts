import { afterEach, describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import startAnthropicOAuth from "../llm/startAnthropicOAuth";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

async function makeCtx() {
    return await mkTestCtx({ env: {
        HYPER_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
        ANTHROPIC_OAUTH_REDIRECT_URI: "http://localhost:53692/callback",
    } });
}

describe("managed Anthropic OAuth connections UI", () => {
    test("disconnected page exposes connect action but no secrets", async () => {
        const ctx = await makeCtx();
        const res = await ctx.fns.procs.http.dispatch({ url: "/llms" });
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("Codex");
        expect(html).toContain("Claude");
        expect(html).toContain("Add Claude account");
        expect(html).toContain('hx-popup="llms.loginPopupFor"');
        expect(html).toContain('&quot;provider&quot;:&quot;claude-code&quot;');
        expect(html).not.toContain("access_enc");
        expect(html).not.toContain("refresh_enc");
        expect(html).not.toContain("code_verifier");
    });

    test("connect route creates pending login and renders manual fallback without verifier", async () => {
        const ctx = await makeCtx();
        // Avoid binding a real callback port while retaining the real PKCE flow.
        ctx.state.registry.llm.startAnthropicOAuth = (c: any, s: any) => startAnthropicOAuth(c, s, { listen: false });
        const res = await ctx.fns.procs.http.dispatch({ method: "POST", url: "/llms/anthropic-oauth/connect" });
        expect(res.status).toBe(303);
        expect(res.headers.get("location")).toBe("/llms");
        const pending = [...ctx.state.llm.anthropicOAuth.pending.values()][0] as any;
        const page = await ctx.fns.procs.http.dispatch({ url: "/llms" });
        const html = await page.text();
        expect(html).toContain("Codex");
        expect(html).toContain("Claude");
        expect(html).not.toContain(pending.verifier);
        expect(html).not.toContain("sk-ant-oat");
    });

    test("manual completion stores credentials but never echoes code or tokens", async () => {
        const ctx = await makeCtx();
        await ctx.fns.llm.startAnthropicOAuth({ listen: false });
        const pending = [...ctx.state.llm.anthropicOAuth.pending.values()][0] as any;
        globalThis.fetch = (async () => Response.json({
            access_token: "oauth-test-access-secret",
            refresh_token: "refresh-super-secret",
            expires_in: 3600,
        })) as any;
        const fd = new FormData();
        fd.set("authorization", `manual-secret-code#${pending.state}`);
        const res = await ctx.fns.procs.http.dispatch({ method: "POST", url: "/llms/anthropic-oauth/complete", body: fd });
        expect(res.status).toBe(303);
        expect(res.headers.get("location")).toBe("/llms");
        const html = await (await ctx.fns.procs.http.dispatch({ url: "/llms" })).text();
        expect((await ctx.fns.llm.anthropicOAuthStatus({})).connected).toBe(true);
        expect(html).not.toContain("manual-secret-code");
        expect(html).not.toContain("oauth-test-access-secret");
        expect(html).not.toContain("refresh-super-secret");
    });

    test("sanitized completion error is visible without echoing submitted input", async () => {
        const ctx = await makeCtx();
        await ctx.fns.llm.startAnthropicOAuth({ listen: false });
        const fd = new FormData();
        fd.set("authorization", "sensitive-invalid-code#wrong-state");
        await ctx.fns.procs.http.dispatch({ method: "POST", url: "/llms/anthropic-oauth/complete", body: fd });
        const html = await (await ctx.fns.procs.http.dispatch({ url: "/llms" })).text();
        expect((ctx.state as any).llm.anthropicOAuth.lastError).toContain("Anthropic OAuth state mismatch");
        expect(html).not.toContain("sensitive-invalid-code");
    });

    test("logout removes only managed credential and returns to connections", async () => {
        const ctx = await makeCtx();
        await ctx.fns.llm.saveAnthropicOAuth({ access: "a", refresh: "r", expiresAt: Date.now() + 60_000 });
        const res = await ctx.fns.procs.http.dispatch({ method: "POST", url: "/llms/anthropic-oauth/logout" });
        expect(res.status).toBe(303);
        expect(res.headers.get("location")).toBe("/llms");
        expect((await ctx.fns.llm.anthropicOAuthStatus({})).connected).toBe(false);
    });
});
