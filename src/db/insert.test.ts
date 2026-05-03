import { test, expect, describe } from "bun:test";
import connect from "./connect";
import migrate from "./migrate";
import exec from "./exec";
import select from "./select";
import insert from "./insert";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: { db: { exec, select, insert } } } as unknown as Context;
    connect(ctx, { path: ":memory:" });
    await migrate(ctx);
    return ctx;
};

describe("db.insert", () => {
    test("inserts a row from an object", async () => {
        const ctx = await mkCtx();
        const r = insert(ctx, { table: "agents", row: { id: "a1", model: "m", system_prompt: "", scratchpad: "{}", created_at: 1, updated_at: 1 } });
        expect(r.changes).toBe(1);
        const rows = select(ctx, { sql: "SELECT id, model FROM agents" });
        expect(rows).toEqual([{ id: "a1", model: "m" }]);
    });

    test("rejects bad table name", async () => {
        const ctx = await mkCtx();
        expect(() => insert(ctx, { table: "agents; DROP TABLE agents;", row: { id: "x" } })).toThrow(/bad table name/);
    });

    test("rejects bad column name", async () => {
        const ctx = await mkCtx();
        expect(() => insert(ctx, { table: "agents", row: { "id; DROP": "x" } })).toThrow(/bad column name/);
    });

    test("empty row object throws", async () => {
        const ctx = await mkCtx();
        expect(() => insert(ctx, { table: "agents", row: {} })).toThrow(/at least one column/);
    });
});
