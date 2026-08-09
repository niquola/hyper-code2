import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.editHashline", () => {
    test("replaces anchored line", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/a.txt";
        await ctx.fns.files.write({ path, content: "one\ntwo\nthree\n" });
        const r = await ctx.fns.files.readHashline({ path });
        const a2 = r.lines[1]!.anchor;
        await ctx.fns.files.editHashline({ input: `@${path}\n= ${a2}\n|TWO` });
        expect(await ctx.fns.files.read({ path })).toBe("one\nTWO\nthree\n");
    });

    test("rejects stale anchor", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/stale.txt";
        await ctx.fns.files.write({ path, content: "one\ntwo\n" });
        const r = await ctx.fns.files.readHashline({ path });
        const a2 = r.lines[1]!.anchor;
        await ctx.fns.files.write({ path, content: "one\nchanged\n" });
        await expect(ctx.fns.files.editHashline({ input: `@${path}\n= ${a2}\n|TWO` })).rejects.toThrow(/stale anchor/);
    });

    test("applies nearby insert and replace against base coordinates", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/nearby.ts";
        await ctx.fns.files.write({
            path,
            content: [
                "export function greet(name?: string) {",
                "  return \"Hello, \" + normalizeUser(name);",
                "}",
                ""
            ].join("\n"),
        });
        const r = await ctx.fns.files.readHashline({ path });
        const ret = r.lines[1]!.anchor;

        await ctx.fns.files.editHashline({
            input: [
                `@${path}`,
                `< ${ret}`,
                `|  const user = normalizeUser(name);`,
                `= ${ret}`,
                `|  return "Hello, " + user + "!";`,
            ].join("\n"),
        });

        expect(await ctx.fns.files.read({ path })).toBe([
            "export function greet(name?: string) {",
            "  const user = normalizeUser(name);",
            "  return \"Hello, \" + user + \"!\";",
            "}",
            ""
        ].join("\n"));
    });

    test("rejects overlapping replace and delete ranges", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/overlap.txt";
        await ctx.fns.files.write({ path, content: "a\nb\nc\nd\n" });
        const r = await ctx.fns.files.readHashline({ path });
        const a2 = r.lines[1]!.anchor;
        const a3 = r.lines[2]!.anchor;
        const a4 = r.lines[3]!.anchor;

        await expect(ctx.fns.files.editHashline({
            input: [
                `@${path}`,
                `= ${a2}..${a3}`,
                `|B`,
                `|C`,
                `- ${a3}..${a4}`,
            ].join("\n"),
        })).rejects.toThrow(/overlap|conflict/i);
    });
});