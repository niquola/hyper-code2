// db module config schema. ENV enters through here: DATABASE_URL → config.url.
// package.json proc.prod.db can set a default; env overrides.
export default {
    url: { type: "string", required: true, default: ".runtime/dev.sqlite", env: "DATABASE_URL" },
} as const satisfies ConfigSchema;
