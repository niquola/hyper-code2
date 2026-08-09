// http module config. PORT env → config.port.
export default {
    port: { type: "integer", required: true, default: 3000, env: "PORT" },
} as const satisfies ConfigSchema;
