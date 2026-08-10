export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Array<{
    id: string;
    model: string;
    title: string;
    turns: number;
    createdAt: number;
    updatedAt: number;
}>> {
    // Postgres folds unquoted aliases to lowercase — camelCase aliases must be quoted.
    // created_at / updated_at / COUNT(*) are BIGINTs and come back as strings → Number().
    const rows = (await ctx.fns.procs.db.select({
        sql: `SELECT
            a.id,
            a.model,
            a.title AS "explicitTitle",
            a.created_at AS "createdAt",
            a.updated_at AS "updatedAt",
            COALESCE((SELECT COUNT(*) FROM messages m WHERE m.agent_id = a.id AND m.role = 'user'), 0) AS turns,
            (SELECT content FROM messages m WHERE m.agent_id = a.id AND m.role = 'user' ORDER BY idx LIMIT 1) AS "firstUser"
        FROM agents a
        WHERE a.archived_at IS NULL
        ORDER BY a.updated_at DESC`,
    })) as any[];
    return rows.map((r: any) => ({
        id: r.id,
        model: r.model,
        title: r.explicitTitle || (r.firstUser ? String(r.firstUser).slice(0, 40) : '(empty)'),
        turns: Number(r.turns),
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
    }));
}
