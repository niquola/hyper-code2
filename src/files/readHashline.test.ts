import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import write from "./write";
import readHashline from "./readHashline";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.readHashline", () => {
    test("returns anchored lines", async () => {
        const ctx = await mkCtx();
        const path = ".hyper/_test_hashline_read/a.txt";
        await write(ctx, { path, content: "aa\nbb\n" });
        const r = await readHashline(ctx, { path });
        expect(r.lines.length).toBeGreaterThanOrEqual(2);
        expect(r.lines[0]!.anchor).toMatch(/^1[a-z0-9]{2}$/);
        expect(r.text).toContain("|aa");
    });
});