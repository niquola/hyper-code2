// Owns `$setting_<key>.ts` — a declared setting descriptor
// ({ type, default, env?, title?, options?, … }). Collected into
// ctx.state.settings.registry keyed "<module>.<key>", the map every
// ctx.fns.settings.* resolver reads.
export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    const st = (((ctx.state as any).settings ??= {}));
    const registry: Map<string, any> = (st.registry ??= new Map());
    for (const e of opts.entries) {
        const descriptor = e.fn ?? (await import(e.abs + `?t=${Date.now()}`)).default;
        if (!descriptor || typeof descriptor !== "object") {
            console.warn(`[settings] skip (no default-export descriptor): ${e.rel}`);
            continue;
        }
        registry.set(`${e.module}.${e.name}`, descriptor);
    }
}
