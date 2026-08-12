---
name: duckdb
description: "Query local NDJSON/JSONL logs, JSON, CSV, Parquet, and DuckDB files with SQL. Use for filtering logs, aggregation, schema discovery, timelines, counts, error analysis, and ad-hoc analytics over workspace files."
---

# duckdb

Runs the installed DuckDB CLI against files visible to the server. Relative paths resolve in the current agent workspace.

## Workflow

1. `duckdb.inspect({ path })` — identify the source, columns, types, and sample rows.
2. `duckdb.ndjson({ path, where?, select?, groupBy?, orderBy?, limit? })` — common NDJSON/log analysis without constructing a full SQL query.
3. `duckdb.query({ sql, db?, maxRows?, timeout? })` — arbitrary read-only DuckDB SQL for joins, windows, aggregations, and multiple files.

Examples:

```ts
await ctx.fns.duckdb.ndjson({
  path: ".runtime/telemetry.ndjson",
  where: "status = 'error'",
  orderBy: "ts DESC",
  limit: 50,
});

await ctx.fns.duckdb.query({
  sql: `SELECT name, count(*) n
        FROM read_ndjson_auto('.runtime/telemetry.ndjson')
        GROUP BY name ORDER BY n DESC`,
});
```

`query` rejects obvious write/DDL statements; it is intended for analytics, not database mutation. Results are JSON-compatible and truncated at `maxRows`.
