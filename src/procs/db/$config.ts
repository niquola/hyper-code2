// db module config schema. ENV enters through here: DATABASE_URL → config.url.
// package.json procs.prod."procs/db" can set a default; env overrides.
// hyper-code2's Postgres lives in ~/.hyper/docker-compose.yml (paradedb :54393).
export default {
    url: { type: "string", required: true, default: "postgres://hyper:hyper@localhost:54393/hyper", env: "DATABASE_URL" },
} as const satisfies ConfigSchema;
