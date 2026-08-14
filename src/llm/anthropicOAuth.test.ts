import { afterEach, describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

async function ctx() {
    return await mkTestCtx({ env: { HYPER_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") } });
}

describe("managed Anthropic OAuth", () => {
    test("PKCE login keeps verifier server-side and rejects state mismatch", async () => {
        const c = await ctx();
        const login = await c.fns.llm.startAnthropicOAuth({ listen: false });
        const u = new URL(login.authorizationUrl);
        const state = u.searchParams.get("state")!;
        expect(u.searchParams.get("code_challenge_method")).toBe("S256");
        expect(u.searchParams.get("code_challenge")).not.toBe(state);
        expect(JSON.stringify(login)).not.toContain(c.state.llm.anthropicOAuth.pending.get(state).verifier);
        await expect(c.fns.llm.completeAnthropicOAuth({ input: `code#wrong-state` })).rejects.toThrow("state mismatch");
    });

    test("exchanges code, stores encrypted credentials, and applies five minute expiry skew", async () => {
        const c = await ctx();
        const before = Date.now();
        let request: any;
        globalThis.fetch = (async (_url: any, init: any) => {
            request = JSON.parse(init.body);
            return Response.json({ access_token: "sk-ant-oat-access", refresh_token: "rotate-me", expires_in: 3600, scope: "user:inference" });
        }) as any;
        const login = await c.fns.llm.startAnthropicOAuth({ listen: false });
        const state = new URL(login.authorizationUrl).searchParams.get("state")!;
        await c.fns.llm.completeAnthropicOAuth({ input: `auth-code#${state}` });
        expect(request.grant_type).toBe("authorization_code");
        expect(request.code_verifier).toBeTruthy();
        const [row] = await c.fns.procs.db.select({ sql: "SELECT * FROM oauth_credentials WHERE provider=?", params: ["anthropic-oauth"] });
        expect(row.access_enc).not.toContain("sk-ant-oat-access");
        expect(row.refresh_enc).not.toContain("rotate-me");
        expect(Number(row.expires_at)).toBeGreaterThanOrEqual(before + 3_299_000);
        expect(Number(row.expires_at)).toBeLessThanOrEqual(Date.now() + 3_301_000);
        expect(await c.fns.llm.getAnthropicOAuthToken({})).toBe("sk-ant-oat-access");
    });

    test("refresh rotates both tokens and omits scope", async () => {
        const c = await ctx();
        await c.fns.llm.saveAnthropicOAuth({ access: "old-access", refresh: "old-refresh", expiresAt: Date.now() - 1 });
        let body: any;
        globalThis.fetch = (async (_url: any, init: any) => {
            body = JSON.parse(init.body);
            return Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 600 });
        }) as any;
        expect(await c.fns.llm.getAnthropicOAuthToken({})).toBe("new-access");
        expect(body).toEqual(expect.objectContaining({ grant_type: "refresh_token", refresh_token: "old-refresh" }));
        expect(body.scope).toBeUndefined();
        const [row] = await c.fns.procs.db.select({ sql: "SELECT * FROM oauth_credentials WHERE provider=?", params: ["anthropic-oauth"] });
        expect(await c.fns.llm.decryptOAuthSecret({ provider: "anthropic-oauth", field: "refresh", envelope: row.refresh_enc })).toBe("new-refresh");
        expect(Number(row.version)).toBe(2);
    });

    test("rejects an expired pending login without contacting the token endpoint", async () => {
        const c = await ctx();
        const login = await c.fns.llm.startAnthropicOAuth({ listen: false });
        const state = new URL(login.authorizationUrl).searchParams.get("state")!;
        c.state.llm.anthropicOAuth.pending.get(state).expiresAt = Date.now() - 1;
        let calls = 0;
        globalThis.fetch = (async () => { calls++; return Response.json({}); }) as any;
        await expect(c.fns.llm.completeAnthropicOAuth({ input: `code#${state}` })).rejects.toThrow("expired");
        expect(calls).toBe(0);
    });


    test("concurrent refreshes exchange only once", async () => {
        const c = await ctx();
        await c.fns.llm.saveAnthropicOAuth({ access: "old", refresh: "refresh", expiresAt: Date.now() - 1 });
        let calls = 0;
        globalThis.fetch = (async () => {
            calls++;
            await Bun.sleep(50);
            return Response.json({ access_token: "fresh", refresh_token: "rotated", expires_in: 600 });
        }) as any;
        const values = await Promise.all([c.fns.llm.getAnthropicOAuthToken({}), c.fns.llm.getAnthropicOAuthToken({})]);
        expect(values).toEqual(["fresh", "fresh"]);
        expect(calls).toBe(1);
    });

    test("logout removes managed credentials", async () => {
        const c = await ctx();
        await c.fns.llm.saveAnthropicOAuth({ access: "a", refresh: "r", expiresAt: Date.now() + 1000 });
        await c.fns.llm.logoutAnthropicOAuth({});
        expect((await c.fns.llm.anthropicOAuthStatus({})).connected).toBe(false);
    });
});
