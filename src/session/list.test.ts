import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import list from "./list";
import start from "../agent/start";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, ":memory:");
    await migrate(ctx);
    return ctx;
};

describe("session.list", () => {
    test("empty → []", async () => {
        expect(list(await mkCtx())).toEqual([]);
    });

    test("returns lightweight summaries ordered by updated_at desc", async () => {
        const ctx = await mkCtx();
        const a = start(ctx, { model: "m1" });
        a.messages.push({ role: "user", content: "first msg" });
        save(ctx, a);

        await new Promise(r => setTimeout(r, 5));
        const b = start(ctx, { model: "m2" });
        save(ctx, b);

        const rows = list(ctx);
        expect(rows).toHaveLength(2);
        expect(rows[0]!.id).toBe(b.id);         // newest first
        expect(rows[1]!.id).toBe(a.id);
        expect(rows[1]!.title).toBe("first msg");
        expect(rows[0]!.title).toBe("(empty)");
        expect(rows[0]!.model).toBe("m2");
    });
});
