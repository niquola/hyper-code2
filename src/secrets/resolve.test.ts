import { describe, expect, test } from "bun:test";
import resolve from "./resolve";

const ctx = (env: Record<string, string> = {}) => ({ env } as unknown as Context);

describe("secrets.resolve", () => {
    test("resolves env references", async () => {
        expect(await resolve(ctx({ TOKEN: "secret" }), null, { ref: "env://TOKEN" })).toBe("secret");
    });

    test("keeps legacy literals", async () => {
        expect(await resolve(ctx(), null, { ref: "legacy-secret" })).toBe("legacy-secret");
    });

    test("rejects unknown providers", async () => {
        await expect(resolve(ctx(), null, { ref: "vault://item" })).rejects.toThrow("unsupported");
    });
});
