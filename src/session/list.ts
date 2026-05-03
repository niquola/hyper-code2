export default function (ctx: Context): Array<{
    id: string;
    model: string;
    title: string;
    turns: number;
    createdAt: number;
    updatedAt: number;
}> {
    const rows = ctx.fns.db.select<any>(ctx, {
        sql: `SELECT
            a.id,
            a.model,
            a.created_at AS createdAt,
            a.updated_at AS updatedAt,
            COALESCE((SELECT COUNT(*) FROM messages m WHERE m.agent_id = a.id AND m.role = 'user'), 0) AS turns,
            (SELECT content FROM messages m WHERE m.agent_id = a.id AND m.role = 'user' ORDER BY idx LIMIT 1) AS firstUser
        FROM agents a
        WHERE a.archived_at IS NULL
        ORDER BY a.updated_at DESC`,
    });
    return rows.map((r: any) => ({
        id: r.id,
        model: r.model,
        title: r.firstUser ? String(r.firstUser).slice(0, 40) : '(empty)',
        turns: r.turns,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
    }));
}
