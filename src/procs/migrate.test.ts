import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("migrate: up (in id order, idempotent) + status + down", async () => {
    // Own world: the host app (hyper-code2) ships real migrations that testCtx
    // already applied — a fork gets a fresh :memory: db and its own list.
    const c = ctx.fns.procs.env.fork({ mode: "test" });
    ((c.state.procs ??= {} as any).migrate ??= {}).list = [
        { id: "001_a", up: (x: Context) => x.fns.procs.db.exec({ sql: "CREATE TABLE a (x INTEGER)" }), down: (x: Context) => x.fns.procs.db.exec({ sql: "DROP TABLE a" }) },
        { id: "002_b", up: (x: Context) => x.fns.procs.db.exec({ sql: "CREATE TABLE b (y INTEGER)" }) },
    ];
    expect((await c.fns.procs.migrate.up({})).applied).toEqual(["001_a", "002_b"]);
    expect((await c.fns.procs.migrate.up({})).applied).toEqual([]); // idempotent
    expect(c.fns.procs.migrate.status({}).every((m: any) => m.applied)).toBe(true);

    expect((await c.fns.procs.migrate.down({})).rolledBack).toEqual(["002_b"]); // last only
    expect(c.fns.procs.migrate.status({}).find((m: any) => m.id === "002_b")!.applied).toBe(false);
});

test("migrate: down on a fresh DB is a no-op (no 'no such table')", async () => {
    const fresh = ctx.fns.procs.env.fork({ mode: "test" }); // own :memory: db, never migrated
    expect((await fresh.fns.procs.migrate.down({})).rolledBack).toEqual([]);
});
