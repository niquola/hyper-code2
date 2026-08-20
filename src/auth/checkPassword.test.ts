import { expect, test } from "bun:test";
import check from "./checkPassword";

test("verifies Bun password hashes", async () => {
    const hash = await Bun.password.hash("correct horse battery staple");
    const ctx: any = { fns: { auth: { password: async () => hash } } };
    expect(await check(ctx, null, { password: "correct horse battery staple" })).toBe(true);
    expect(await check(ctx, null, { password: "wrong" })).toBe(false);
});
