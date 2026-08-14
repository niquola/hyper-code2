// Safe low-cardinality DB attributes: operation and normalized fingerprint,
// never bound parameters or message contents.
/**
 * Perform db attrs for the telemetry subsystem.
 * @param opts.sql The SQL statement to execute.
 */
export default function (_ctx: Context, _session: Session | null, opts: { sql: string }) {
    const raw = String(opts.sql ?? "").trim();
    const operation = raw.match(/^([a-z]+)/i)?.[1]?.toUpperCase() ?? "SQL";
    const fingerprint = raw
        .replace(/'(?:''|[^'])*'/g, "?")
        .replace(/\b\d+(?:\.\d+)?\b/g, "?")
        .replace(/\s+/g, " ")
        .slice(0, 500);
    return { "db.system": "postgresql", "db.operation": operation, "db.query.summary": fingerprint };
}
