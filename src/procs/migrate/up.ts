// Run pending migrations (collected from $migration_<id>.ts into ctx.state.
// migrations) in id order, recording each in the _migrations table. Idempotent:
// already-applied ids are skipped. Each migration's `up(ctx)` runs the change.
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    ctx.fns.procs.db.exec({ sql: "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)" });
    // hyper-code2 compat: pre-procs DBs tracked migrations as (name, applied_at).
    // Same ids, different column name — rename in place so nothing re-applies.
    const cols = ctx.fns.procs.db.select({ sql: "PRAGMA table_info(_migrations)" }).map((c: any) => c.name);
    if (cols.includes("name") && !cols.includes("id")) {
        ctx.fns.procs.db.exec({ sql: "ALTER TABLE _migrations RENAME COLUMN name TO id" });
    }
    const applied = new Set(ctx.fns.procs.db.select({ sql: "SELECT id FROM _migrations" }).map((r: any) => r.id));
    const migs = [...(ctx.state.procs?.migrate?.list ?? [])].sort((a, b) => a.id.localeCompare(b.id));

    const ran: string[] = [];
    for (const m of migs) {
        if (applied.has(m.id)) continue;
        await m.up(ctx);
        ctx.fns.procs.db.run({ sql: "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)", params: [m.id, new Date().toISOString()] });
        ctx.fns.procs.log.info({ event: "migrate.up", msg: m.id });
        ran.push(m.id);
    }
    return { applied: ran };
}
