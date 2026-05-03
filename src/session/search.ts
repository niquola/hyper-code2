export default function (ctx: Context, opts: { query: string; limit?: number }): Array<{
    agentId: string;
    idx: number;
    role: string;
    content: string;
    ts: number;
}> {
    const q = String(opts.query ?? "").trim();
    if (!q) return [];
    return ctx.fns.db.select<any>(ctx, {
        sql: `
        SELECT agent_id AS agentId, idx, role, content, ts
        FROM messages
        WHERE content IS NOT NULL
          AND content LIKE $pattern COLLATE NOCASE
        ORDER BY ts DESC
        LIMIT $limit
    `,
        params: { $pattern: `%${q}%`, $limit: opts.limit ?? 50 },
    });
}
