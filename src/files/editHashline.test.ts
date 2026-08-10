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
    test("literal replace requires exactly one match", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/literal.txt";
        await ctx.fns.files.write({ path, content: "alpha old omega\n" });
        await ctx.fns.files.editHashline({ input: `@${path}\nreplace "old" "new"` });
        expect(await ctx.fns.files.read({ path })).toBe("alpha new omega\n");
        await expect(ctx.fns.files.editHashline({
            input: `@${path}\nreplace "missing" "x"`,
        })).rejects.toThrow(/exactly one|found 0/i);
    });

    test("replace-all replaces every literal match", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/literal-all.txt";
        await ctx.fns.files.write({ path, content: "old old\nold\n" });
        await ctx.fns.files.editHashline({ input: `@${path}\nreplace-all "old" "new"` });
        expect(await ctx.fns.files.read({ path })).toBe("new new\nnew\n");
    });

    test("literal replace accepts JSON escapes", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/literal-escaped.txt";
        await ctx.fns.files.write({ path, content: 'const x = "a";\nconst y = "b";\n' });
        await ctx.fns.files.editHashline({
            input: `@${path}\nreplace "const x = \\"a\\";\\n" "const x = \\"z\\";\\n"`,
        });
        expect(await ctx.fns.files.read({ path })).toBe('const x = "z";\nconst y = "b";\n');
    });

    test("applies multiple literal replacements against the original file", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/literal-many.txt";
        await ctx.fns.files.write({ path, content: "const a = 1;\nconst b = 2;\n" });
        await ctx.fns.files.editHashline({
            input: [
                `@${path}`,
                `replace "const a = 1;" "const a = 10;"`,
                `replace "const b = 2;" "const b = 20;"`,
            ].join("\n"),
        });
        expect(await ctx.fns.files.read({ path })).toBe("const a = 10;\nconst b = 20;\n");
    });

    test("literal replacements do not match text created by an earlier replacement", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/literal-original.txt";
        await ctx.fns.files.write({ path, content: "alpha\n" });
        await expect(ctx.fns.files.editHashline({
            input: `@${path}\nreplace "alpha" "beta"\nreplace "beta" "gamma"`,
        })).rejects.toThrow(/found 0/i);
        expect(await ctx.fns.files.read({ path })).toBe("alpha\n");
    });

    test("rejects overlapping literal replacements", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_edit/literal-overlap.txt";
        await ctx.fns.files.write({ path, content: "abcdef\n" });
        await expect(ctx.fns.files.editHashline({
            input: `@${path}\nreplace "abcd" "x"\nreplace "cdef" "y"`,
        })).rejects.toThrow(/overlap|conflict/i);
        expect(await ctx.fns.files.read({ path })).toBe("abcdef\n");
    });

});