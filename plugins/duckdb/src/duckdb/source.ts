/**
 * Resolves a supported local analytics file into a DuckDB table expression.
 *
 * Relative paths are resolved against the active workspace. The returned table
 * expression safely quotes the path and selects the reader from its extension.
 */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** NDJSON, JSON, CSV, TSV, or Parquet file path. */
        path: string;
    },
): { path: string; table: string; format: string } {
    const path = ctx.fns.workspace.resolve({ path: opts.path });
    const quoted = `'${path.replaceAll("'", "''")}'`;
    const lower = path.toLowerCase();
    if (/\.(ndjson|jsonl)$/.test(lower)) return { path, table: `read_ndjson_auto(${quoted})`, format: "ndjson" };
    if (lower.endsWith(".json")) return { path, table: `read_json_auto(${quoted})`, format: "json" };
    if (/\.(csv|tsv)$/.test(lower)) return { path, table: `read_csv_auto(${quoted}${lower.endsWith(".tsv") ? ", delim='\\t'" : ""})`, format: lower.endsWith(".tsv") ? "tsv" : "csv" };
    if (/\.(parquet|pq)$/.test(lower)) return { path, table: `read_parquet(${quoted})`, format: "parquet" };
    throw new Error("duckdb: unsupported source; expected .ndjson/.jsonl/.json/.csv/.tsv/.parquet");
}
