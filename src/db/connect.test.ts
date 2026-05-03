import { test, expect, describe } from "bun:test";
import connect from "./connect";
import migrate from "./migrate";

const mkCtx = () => ({ state: {}, env: {} } as unknown as Context);

describe("session.connect", () => {
    test("opens :memory: db, stores on ctx.state.db", () => {
        const ctx = mkCtx();
        const db = connect(ctx, { path: ":memory:" });
        expect((ctx.state as any).db).toBe(db);
    });

    test("after migrate — schema + typed columns present", async () => {
        const ctx = mkCtx();
        connect(ctx, { path: ":memory:" });
        await migrate(ctx);
        const db = (ctx.state as any).db;
        const tables = (db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as any[])
            .map((t: any) => t.name);
        expect(tables).toContain("agents");
        expect(tables).toContain("messages");
        expect(tables).toContain("events");
        expect(tables).toContain("_migrations");
        const cols = (name: string) => (db.query(`PRAGMA table_info(${name})`).all() as any[]).map((c: any) => c.name);
        expect(cols("agents")).toEqual(["id", "model", "system_prompt", "scratchpad", "created_at", "updated_at", "archived_at", "parent_id", "fork_offset", "next_run_at", "last_processed_msg_idx", "run_state", "run_started_at", "last_error"]);
        expect(cols("messages")).toEqual(["agent_id", "idx", "role", "content", "ts", "excluded_from_llm", "excluded_from_cursor"]);
        expect(cols("events")).toEqual(["agent_id", "idx", "type", "payload", "ts"]);
    });
});
