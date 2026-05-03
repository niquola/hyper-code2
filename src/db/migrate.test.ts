import { test, expect, describe } from "bun:test";
import connect from "./connect";
import migrate from "./migrate";

const mkCtx = () => ({ state: {}, env: {} } as unknown as Context);

describe("db.migrate", () => {
    test("applies baseline migration and records it in _migrations", async () => {
        const ctx = mkCtx();
        connect(ctx, { path: ":memory:" });
        const res = await migrate(ctx);
        expect(res.applied).toContain("20260418000000_init");
        const db = (ctx.state as any).db;
        const rows = db.query("SELECT name FROM _migrations").all() as any[];
        expect(rows.map((r: any) => r.name)).toContain("20260418000000_init");
    });

    test("second call is a no-op (same migration not applied twice)", async () => {
        const ctx = mkCtx();
        connect(ctx, { path: ":memory:" });
        await migrate(ctx);
        const second = await migrate(ctx);
        expect(second.applied).toEqual([]);
    });

    test("applies in lexicographic timestamp order", async () => {
        // Write a second migration into .hyper and expect it to be applied after the baseline.
        const dir = ".hyper/testmig_" + Date.now();
        await Bun.write(`${dir}/$migrate_20260418000001_probe.up.sql`,
            `CREATE TABLE IF NOT EXISTS _probe (k TEXT PRIMARY KEY);`);
        try {
            const ctx = mkCtx();
            connect(ctx, { path: ":memory:" });
            const res = await migrate(ctx);
            expect(res.applied.indexOf("20260418000000_init")).toBeLessThan(res.applied.indexOf("20260418000001_probe"));
            const db = (ctx.state as any).db;
            const tables = (db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map((r: any) => r.name);
            expect(tables).toContain("_probe");
        } finally {
            await Bun.$`rm -rf ${dir}`.quiet();
        }
    });
});
