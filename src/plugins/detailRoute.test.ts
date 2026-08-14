import { test, expect } from "bun:test";
import { testCtx } from "../$test";
import route from "./$route_$name_GET";

const ctx = await testCtx();

test("plugin detail renders live documented function schemas", async () => {
    const page: any = await route(ctx, null, {
        req: new Request("http://localhost/plugins/duckdb"),
        params: { name: "duckdb" },
    });
    expect(page.title).toBe("DuckDB");
    expect(page.main).toContain("Runtime functions");
    expect(page.main).toContain("duckdb.query");
    expect(page.main).toContain("Read-only DuckDB SQL statement.");
    expect(page.main).toContain("Promise&lt;{ rows: any[]; rowCount: number; truncated: boolean }&gt;");
    expect(page.main).toContain("5/5 documented");
    expect(page.main).toContain("default 1000 · min 1 · max 10000");
});
