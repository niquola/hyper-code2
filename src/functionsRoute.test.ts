import { test, expect } from "bun:test";
import { testCtx } from "./$test";
import route from "./$route_functions_GET";

const ctx = await testCtx();

test("GET /functions renders searchable live runtime documentation", () => {
    const page: any = route(ctx, null, {
        req: new Request("http://localhost/functions?q=read+only+duckdb+sql"),
        params: {},
    });
    expect(page.title).toBe("functions: read only duckdb sql");
    expect(page.main).toContain("Runtime functions");
    expect(page.main).toContain("duckdb.query");
    expect(page.main).toContain("Read-only DuckDB SQL statement.");
    expect(page.main).toContain("Promise&lt;{ rows: any[]; rowCount: number; truncated: boolean }&gt;");
    expect(page.main).toContain("Search in English");
});

test("functions page is present in the global navigation", async () => {
    const items = await ctx.fns.nav.items({ q: "functions", limit: 10 });
    expect(items).toContainEqual({
        label: "functions",
        href: "/functions",
        hint: "page · searchable runtime API documentation",
    });
});
