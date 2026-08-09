// Roll back the most recently applied migration (or N via opts.steps), running
// its down(ctx) and removing it from _migrations.
export default async function (ctx: Context, _session: Session | null, opts?: { steps?: number }) {
    const steps = opts?.steps ?? 1;
    // Match up/status: ensure the bookkeeping table exists so down() on a fresh
    // DB is a no-op instead of throwing "no such table: _migrations".
    ctx.fns.procs.db.exec({ sql: "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)" });
    const byId = new Map((ctx.state.procs?.migrate?.list ?? []).map((m) => [m.id, m]));
    const applied = ctx.fns.procs.db.select({ sql: "SELECT id FROM _migrations ORDER BY id DESC" }).map((r: any) => r.id);

    const rolledBack: string[] = [];
    for (const id of applied.slice(0, steps)) {
        const m = byId.get(id);
        if (m?.down) await m.down(ctx);
        ctx.fns.procs.db.run({ sql: "DELETE FROM _migrations WHERE id = ?", params: [id] });
        ctx.fns.procs.log.info({ event: "migrate.down", msg: id, reverted: !!m?.down });
        rolledBack.push(id);
    }
    return { rolledBack };
}
