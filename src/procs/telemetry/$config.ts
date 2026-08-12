// Built-in tracing config. NDJSON remains useful when Postgres itself is sick.
export default {
    enabled:   { type: "boolean", default: true, env: "TELEMETRY_ENABLED" },
    slowMs:    { type: "number", default: 100, env: "TELEMETRY_SLOW_MS" },
    maxRecent: { type: "integer", default: 10000, env: "TELEMETRY_MAX_RECENT" },
    flushMs:   { type: "integer", default: 1000, env: "TELEMETRY_FLUSH_MS" },
} as const satisfies ConfigSchema;
