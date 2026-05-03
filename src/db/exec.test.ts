import { test, expect, describe } from "bun:test";
import connect from "./connect";
import migrate from "./migrate";
import exec from "./exec";
import select from "./select";

const mkCtx = async () => {
    const ctx = { state: {}, env: {} } as unknown as Context;
    connect(ctx, { path: ":memory:" });
    await migrate(ctx);
    return ctx;
};

describe("db.exec + db.select", () => {
    test("exec runs INSERT, returns changes", async () => {
        const ctx = await mkCtx();
        const r = exec(ctx, { sql: "INSERT INTO agents (id, model, created_at, updated_at) VALUES (?, ?, ?, ?)", params: ["a1", "m", 1, 2] });
        expect(r.changes).toBe(1);
    });

    test("exec with named params", async () => {
        const ctx = await mkCtx();
        exec(ctx, { sql: "INSERT INTO agents (id, model, created_at, updated_at) VALUES ($id, $m, $t, $t)", params: { $id: "a1", $m: "x", $t: 1 } });
        const rows = select<any>(ctx, { sql: "SELECT id, model FROM agents" });
        expect(rows).toEqual([{ id: "a1", model: "x" }]);
    });

    test("select with positional params", async () => {
        const ctx = await mkCtx();
        exec(ctx, { sql: "INSERT INTO agents (id, model, created_at, updated_at) VALUES (?, ?, ?, ?)", params: ["a1", "m", 1, 2] });
        exec(ctx, { sql: "INSERT INTO agents (id, model, created_at, updated_at) VALUES (?, ?, ?, ?)", params: ["a2", "n", 1, 2] });
        const rows = select<{ id: string }>(ctx, { sql: "SELECT id FROM agents WHERE model = ?", params: ["n"] });
        expect(rows).toEqual([{ id: "a2" }]);
    });
});
