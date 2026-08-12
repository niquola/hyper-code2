export default async function (ctx: Context, _session: Session | null, opts: { id: string }): Promise<types.agent.Agent | null> {
    const { id } = opts;
    const rows = (await ctx.fns.procs.db.select({ sql: 'SELECT * FROM agents WHERE id = ? AND archived_at IS NULL', params: [id] })) as any[];
    const row = rows[0];
    if (!row) return null;

    const agent: types.agent.Agent = {
        id: row.id,
        model: row.model,
        title: row.title ?? "",
        workspaceDir: row.workspace_dir || process.cwd(),
        systemPrompt: row.system_prompt,
        tools: row.tools == null ? undefined : (typeof row.tools === 'string' ? JSON.parse(row.tools) : row.tools),
        scratchpad: JSON.parse(row.scratchpad),
        messages: [],
        statusLine: row.status_line ?? "",
        statusLineEvery: Math.max(1, Number(row.status_line_every ?? 1)),
        reflection: row.reflection == null ? null : (typeof row.reflection === 'string' ? JSON.parse(row.reflection) : row.reflection),
        events: [],
        sleepContext: row.sleep_context == null ? null : (typeof row.sleep_context === 'string' ? JSON.parse(row.sleep_context) : row.sleep_context),
        cursors: {},
        subscribers: new Set(),
        waiters: [],
        isStreaming: false,
        abortController: null,
        parentId: row.parent_id ?? null,
        forkOffset: row.fork_offset ?? null,
    };
    return await ctx.fns.session.syncAgentState({ agent });
}
