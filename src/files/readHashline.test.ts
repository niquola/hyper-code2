import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.readHashline", () => {
    test("returns anchored lines", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_read/a.txt";
        await ctx.fns.files.write({ path, content: "aa\nbb\n" });
        const r = await ctx.fns.files.readHashline({ path });
        expect(r.lines.length).toBeGreaterThanOrEqual(2);
        expect(r.lines[0]!.anchor).toMatch(/^1[a-z0-9]{2}$/);
        expect(r.text).toContain("|aa");
    });
});