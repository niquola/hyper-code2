import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { testCtx } from "../../../../src/$test";

const ctx = await testCtx({ env: { PROCS_PLUGINS: "./plugins" } });

test("inspects and queries NDJSON with DuckDB", async () => {
    const dir = mkdtempSync(join(tmpdir(), "duckdb-plugin-"));
    const path = join(dir, "events.ndjson");
    writeFileSync(path, [
        JSON.stringify({ level: "info", ms: 5 }),
        JSON.stringify({ level: "error", ms: 20 }),
        JSON.stringify({ level: "error", ms: 30 }),
    ].join("\n") + "\n");
    try {
        const inspected = await ctx.fns.duckdb.inspect({ path, sample: 2 });
        expect(inspected.format).toBe("ndjson");
        expect(inspected.columns.map((x: any) => x.name)).toEqual(["level", "ms"]);
        const result = await ctx.fns.duckdb.ndjson({ path, select: "level, count(*) AS n, avg(ms) AS avg_ms", groupBy: "level", orderBy: "n DESC" });
        expect(result.rows[0]).toEqual({ level: "error", n: 2, avg_ms: 25 });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("query rejects write SQL", async () => {
    await expect(ctx.fns.duckdb.query({ sql: "CREATE TABLE nope(a int)" })).rejects.toThrow(/read-only/);
});
