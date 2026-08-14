// `$migration_<id>.ts` — collected, not run: `migrate.up` applies what is
// pending in id order and records it. Replacing in place rather than pushing is
// what lets a migration be hot-reloaded while it is still pending.

/**
 * Load loader migration declarations into the runtime.
 * @param opts.entries The loader entries to register.
 */
export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    for (const entry of opts.entries) {
        const mod = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        if (!mod?.up) continue;
        const list = ((ctx.state.procs.migrate ??= {}).list ??= []);
        const record = { id: entry.migrationId, up: mod.up, down: mod.down };
        const at = list.findIndex((m: any) => m.id === entry.migrationId);
        if (at >= 0) list[at] = record; else list.push(record);
    }
}
