// `$cli_<command>.ts` — a command for `bun script/cli.ts`, which boots the
// registry and nothing else. `_` becomes `:`, so `$cli_db_seed.ts` is `db:seed`.

/**
 * Load loader cli declarations into the runtime.
 * @param opts.entries The loader entries to register.
 */
export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    for (const entry of opts.entries) {
        const fn = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        if (typeof fn === "function") (((ctx.state as any).procs ??= {}).cli ??= {})[entry.command] = fn;
    }
}
