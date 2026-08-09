export default function (ctx: Context, _session: Session | null, opts: { query: string; limit?: number }): Array<{
    agentId: string;
    idx: number;
    role: string;
    content: string;
    ts: number;
}> {
    const q = String(opts.query ?? "").trim();
    if (!q) return [];
    return ctx.fns.procs.db.select({
        sql: `
        SELECT agent_id AS agentId, idx, role, content, ts
        FROM messages
        WHERE content IS NOT NULL
          AND content LIKE $pattern COLLATE NOCASE
        ORDER BY ts DESC
        LIMIT $limit
    `,
        params: { $pattern: `%${q}%`, $limit: opts.limit ?? 50 },
    }) as any[];
}
