// `$config.ts` — a module's configuration schema. Collected, never imported by
// the module itself: `config.resolve({ module })` reads it from here, which is
// why a module can be typed against its own schema without a circular import.

export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    for (const entry of opts.entries) {
        const schema = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        ((ctx.state.procs.config ??= {}).schemas ??= {})[entry.moduleDir] = schema;
    }
}
