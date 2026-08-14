import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("OAuth secret envelopes", () => {
    test("round trips and binds provider/field as authenticated data", async () => {
        const ctx = await mkTestCtx({ env: { HYPER_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64") } });
        const envelope = await ctx.fns.llm.encryptOAuthSecret({ provider: "anthropic-oauth", field: "access", value: "secret-token" });
        expect(envelope).not.toContain("secret-token");
        expect(await ctx.fns.llm.decryptOAuthSecret({ provider: "anthropic-oauth", field: "access", envelope })).toBe("secret-token");
        await expect(ctx.fns.llm.decryptOAuthSecret({ provider: "anthropic-oauth", field: "refresh", envelope })).rejects.toThrow("cannot be decrypted");
    });
});
