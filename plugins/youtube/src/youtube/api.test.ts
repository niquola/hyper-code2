import { expect, test } from "bun:test";
import api from "./api";

test("youtube.api validates endpoint before resolving credentials", async () => {
    const ctx: any = { state: {}, env: {}, fns: { secrets: { resolve: () => { throw new Error("must not resolve"); } } } };
    await expect(api(ctx, null, { endpoint: "../secret" })).rejects.toThrow("valid endpoint");
});
