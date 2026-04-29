import { test, expect, describe } from "bun:test";
import connect from "./connect";
import migrate from "./migrate";

const mkCtx = () => ({ state: {}, env: {} } as unknown as Context);

describe("session.connect", () => {
    test("opens :memory: db, stores on ctx.state.db", () => {
        const ctx = mkCtx();
        const db = connect(ctx, ":memory:");
        expect((ctx.state as any).db).toBe(db);
    });

    test("after migrate — schema + typed columns present", async () => {
        const ctx = mkCtx();
        connect(ctx, ":memory:");
        await migrate(ctx);
        const db = (ctx.state as any).db;
        const tables = (db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as any[])
            .map((t: any) => t.name);
        expect(tables).toContain("agents");
        expect(tables).toContain("messages");
        expect(tables).toContain("events");
        expect(tables).toContain("_migrations");
        const cols = (name: string) => (db.query(`PRAGMA table_info(${name})`).all() as any[]).map((c: any) => c.name);
        expect(cols("agents")).toEqual(["id", "model", "system_prompt", "tools", "scratchpad", "created_at", "updated_at", "archived_at"]);
        expect(cols("messages")).toEqual(["agent_id", "idx", "role", "content", "tool_calls", "tool_call_id", "ts"]);
        expect(cols("events")).toEqual(["agent_id", "idx", "type", "payload", "ts"]);
    });
});
