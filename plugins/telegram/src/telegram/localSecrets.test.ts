import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../../../../src/_testCtx.entry";

describe("Telegram encrypted local credentials", () => {
    test("local config and StringSession survive bootstrap provider outage", async () => {
        const ctx = await mkTestCtx({ env: { HYPER_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 31).toString("base64") } });
        const config = JSON.stringify({ apiId: 1, apiHash: "hash" });
        await ctx.fns.secrets.putLocal({ namespace: "telegram", name: "config", value: config, source: "test" });
        await ctx.fns.secrets.putLocal({ namespace: "telegram", name: "session", value: "session-string", source: "test" });
        ctx.state.registry.secrets.resolve = async () => { throw new Error("1Password unavailable"); };
        (ctx.state as any).secrets = undefined;

        expect(await ctx.fns.secrets.get({ ref: "op://hyper/telegram config.json/value", namespace: "telegram", name: "config" })).toBe(config);
        expect(await ctx.fns.secrets.get({ ref: "op://hyper/telegram session.txt/value", namespace: "telegram", name: "session" })).toBe("session-string");
    });
});
