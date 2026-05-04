import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import write from "./write";
import read from "./read";
import readHashline from "./readHashline";
import editHashline from "./editHashline";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.editHashline", () => {
    test("replaces anchored line", async () => {
        const ctx = await mkCtx();
        const path = ".hyper/_test_hashline_edit/a.txt";
        await write(ctx, { path, content: "one\ntwo\nthree\n" });
        const r = await readHashline(ctx, { path });
        const a2 = r.lines[1]!.anchor;
        await editHashline(ctx, { input: `@${path}\n= ${a2}\n|TWO` });
        expect(await read(ctx, { path })).toBe("one\nTWO\nthree\n");
    });

    test("rejects stale anchor", async () => {
        const ctx = await mkCtx();
        const path = ".hyper/_test_hashline_edit/stale.txt";
        await write(ctx, { path, content: "one\ntwo\n" });
        const r = await readHashline(ctx, { path });
        const a2 = r.lines[1]!.anchor;
        await write(ctx, { path, content: "one\nchanged\n" });
        await expect(editHashline(ctx, { input: `@${path}\n= ${a2}\n|TWO` })).rejects.toThrow(/stale anchor/);
    });

    test("applies nearby insert and replace against base coordinates", async () => {
        const ctx = await mkCtx();
        const path = ".hyper/_test_hashline_edit/nearby.ts";
        await write(ctx, {
            path,
            content: [
                "export function greet(name?: string) {",
                "  return \"Hello, \" + normalizeUser(name);",
                "}",
                ""
            ].join("\n"),
        });
        const r = await readHashline(ctx, { path });
        const ret = r.lines[1]!.anchor;

        await editHashline(ctx, {
            input: [
                `@${path}`,
                `< ${ret}`,
                `|  const user = normalizeUser(name);`,
                `= ${ret}`,
                `|  return "Hello, " + user + "!";`,
            ].join("\n"),
        });

        expect(await read(ctx, { path })).toBe([
            "export function greet(name?: string) {",
            "  const user = normalizeUser(name);",
            "  return \"Hello, \" + user + \"!\";",
            "}",
            ""
        ].join("\n"));
    });

    test("rejects overlapping replace and delete ranges", async () => {
        const ctx = await mkCtx();
        const path = ".hyper/_test_hashline_edit/overlap.txt";
        await write(ctx, { path, content: "a\nb\nc\nd\n" });
        const r = await readHashline(ctx, { path });
        const a2 = r.lines[1]!.anchor;
        const a3 = r.lines[2]!.anchor;
        const a4 = r.lines[3]!.anchor;

        await expect(editHashline(ctx, {
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