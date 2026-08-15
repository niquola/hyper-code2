/** List for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts?: {
        /** Include archived used by the operation. */
includeArchived?: boolean }): Promise<Array<{
    id: string;
    model: string;
    title: string;
    turns: number;
    createdAt: number;
    updatedAt: number;
    workspaceDir: string;
    runState: string;
    unread: number;
    archivedAt: number | null;
    parentId: string | null;
    delegated: boolean;
}>> {
    // Postgres folds unquoted aliases to lowercase — camelCase aliases must be quoted.
    // created_at / updated_at / COUNT(*) are BIGINTs and come back as strings → Number().
    //
    // `unread` is WhatsApp's number: assistant messages past the reader's
    // watermark. The watermark lives in kv as seen:<agent id>, written by the
    // open chat's poll (agent/$route_$id_events.html_GET) — so having the chat
    // open IS reading it, and a badge only grows on agents you are not looking at.
    const rows = (await ctx.fns.procs.db.select({
        sql: `SELECT
            a.id,
            a.model,
            a.title AS "explicitTitle",
            a.workspace_dir AS "workspaceDir",
            a.run_state AS "runState",
            a.created_at AS "createdAt",
            a.archived_at AS "archivedAt",
            a.updated_at AS "updatedAt",
            COALESCE(a.parent_id, NULLIF((a.scratchpad::jsonb #>> '{delegation,parentId}'), ''), NULLIF((a.scratchpad::jsonb #>> '{delegateTask,parentId}'), '')) AS "parentId",
            ((a.scratchpad::jsonb #>> '{delegation,parentId}') IS NOT NULL OR (a.scratchpad::jsonb #>> '{delegateTask,parentId}') IS NOT NULL) AS delegated,
            COALESCE((SELECT COUNT(*) FROM messages m WHERE m.agent_id = a.id AND m.role = 'user'), 0) AS turns,
            COALESCE((SELECT COUNT(*) FROM messages m WHERE m.agent_id = a.id AND m.role = 'assistant'
                AND m.idx > COALESCE((SELECT k.value::int FROM kv k WHERE k.key = 'seen:' || a.id), -1)), 0) AS unread,
            (SELECT content FROM messages m WHERE m.agent_id = a.id AND m.role = 'user' ORDER BY idx LIMIT 1) AS "firstUser"
        FROM agents a
        ${opts?.includeArchived ? "" : "WHERE a.archived_at IS NULL"}
        ORDER BY a.updated_at DESC`,
    })) as any[];
    return rows.map((r: any) => ({
        id: r.id,
        model: r.model,
        title: r.explicitTitle || (r.firstUser ? String(r.firstUser).slice(0, 40) : '(empty)'),
        turns: Number(r.turns),
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
        workspaceDir: r.workspaceDir || '',
        runState: r.runState || 'idle',
        unread: Number(r.unread),
        archivedAt: r.archivedAt == null ? null : Number(r.archivedAt),
        parentId: r.parentId == null ? null : String(r.parentId),
        delegated: r.delegated === true || r.delegated === 't' || r.delegated === 1,
    }));
}
