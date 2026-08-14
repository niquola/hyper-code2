export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; predicate: "file.exists" | "db.rows" | "http.ok" | "runtime.fn"; opts: Record<string, any>; reason: string; everyMs?: number; timeoutMs?: number },
): Promise<{ watchId: string; nextCheckAt: number; timeoutAt: number }> {
    const agentRow = ((await ctx.fns.procs.db.select({ sql: "SELECT id FROM agents WHERE id = ? AND archived_at IS NULL", params: [opts.id] })) as any[])[0];
    if (!agentRow) throw new Error(`agent not found: ${opts.id}`);
    const reason = String(opts.reason ?? "").trim().slice(0, 1000);
    if (!reason) throw new Error("wakeUpWhen: reason is required");
    const intervalMs = Math.max(5_000, Math.min(24 * 60 * 60_000, Math.floor(Number(opts.everyMs ?? 5 * 60_000))));
    const timeoutMs = Math.max(intervalMs, Math.min(30 * 24 * 60 * 60_000, Math.floor(Number(opts.timeoutMs ?? 60 * 60_000))));
    // Validate name and options before persisting.
    if (!["file.exists", "db.rows", "http.ok", "runtime.fn"].includes(opts.predicate)) throw new Error(`unknown wake predicate: ${opts.predicate}`);
    const now = Date.now();
    const watchId = `w_${Bun.randomUUIDv7()}`;
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO agent_watches (id, agent_id, predicate, opts, reason, interval_ms, next_check_at, timeout_at, created_at)
              VALUES (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?)`,
        params: [watchId, opts.id, opts.predicate, JSON.stringify(opts.opts ?? {}), reason, intervalMs, now, now + timeoutMs, now],
    });
    ctx.fns.events.refreshAgentMeta({ agentId: opts.id, reason: "watch-set" });
    ctx.fns.agent.wakeWorker({});
    return { watchId, nextCheckAt: now, timeoutAt: now + timeoutMs };
}
