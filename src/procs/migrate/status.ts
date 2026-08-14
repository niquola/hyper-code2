// Migration status: each known migration with applied/pending.
/**
 * Perform status for the migrate subsystem.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    await ctx.fns.procs.db.exec({ sql: "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)" });
    const applied = new Set((await ctx.fns.procs.db.select({ sql: "SELECT id FROM _migrations" })).map((r: any) => r.id));
    return [...(ctx.state.procs?.migrate?.list ?? [])]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((m) => ({ id: m.id, applied: applied.has(m.id) }));
}
