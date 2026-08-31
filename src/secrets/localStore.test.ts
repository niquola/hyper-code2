import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("encrypted local secret store", () => {
    test("persists encrypted values and binds namespace/name", async () => {
        const ctx = await mkTestCtx({ env: { HYPER_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString("base64") } });
        await ctx.fns.secrets.putLocal({ namespace: "google", name: "token:a", value: "refresh-secret", source: "test" });
        const [row] = await ctx.fns.procs.db.select({ sql: "SELECT value_enc,source,version FROM local_secrets WHERE namespace=? AND name=?", params: ["google", "token:a"] });
        expect(row.value_enc).not.toContain("refresh-secret");
        expect(row.source).toBe("test");
        expect(await ctx.fns.secrets.getLocal({ namespace: "google", name: "token:a" })).toBe("refresh-secret");
        await expect(ctx.fns.secrets.decryptLocal({ namespace: "google", name: "token:b", envelope: row.value_enc })).rejects.toThrow("cannot be decrypted");
    });

    test("transparent get uses encrypted local value before bootstrap provider", async () => {
        const ctx = await mkTestCtx({ env: { HYPER_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 12).toString("base64") } });
        await ctx.fns.secrets.putLocal({ namespace: "service", name: "api", value: "cached-secret" });
        ctx.state.registry.secrets.resolve = async () => { throw new Error("bootstrap must not run"); };
        expect(await ctx.fns.secrets.get({ ref: "op://vault/item/field", namespace: "service", name: "api" })).toBe("cached-secret");
    });

    test("first bootstrap resolution is encrypted and survives memory reset", async () => {
        const ctx = await mkTestCtx({ env: { HYPER_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 13).toString("base64") } });
        let calls = 0;
        ctx.state.registry.secrets.resolve = async () => { calls++; return "from-provider"; };
        expect(await ctx.fns.secrets.get({ ref: "op://vault/item/field", namespace: "service", name: "api" })).toBe("from-provider");
        (ctx.state as any).secrets = undefined;
        ctx.state.registry.secrets.resolve = async () => { throw new Error("provider offline"); };
        expect(await ctx.fns.secrets.get({ ref: "op://vault/item/field", namespace: "service", name: "api" })).toBe("from-provider");
        expect(calls).toBe(1);
    });
});
