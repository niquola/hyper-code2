// ctx.state.procs?.config — the schemas, collected from every `$config.ts`. Keyed by
// the module they belong to, which is how `config.resolve({ module })` finds one
// without the module importing its own schema.
export type State = { schemas?: Record<string, ConfigSchema> };
