import { expect, test } from "bun:test";
import api from "./api";

test("gplaces.api validates path before resolving credentials", async () => {
    const ctx: any = { state: {}, env: {}, fns: { secrets: { resolve: () => { throw new Error("must not resolve"); } } } };
    await expect(api(ctx, null, { path: "https://example.com" })).rejects.toThrow("must start with /");
});
