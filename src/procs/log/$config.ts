// log module config. LOG_LEVEL / LOG_FORMAT / SERVICE_NAME from env override.
export default {
    level:   { type: "string", default: "info",   env: "LOG_LEVEL" },
    format:  { type: "string", default: "pretty", env: "LOG_FORMAT" },
    service: { type: "string", default: "procs",  env: "SERVICE_NAME" },
} as const satisfies ConfigSchema;
