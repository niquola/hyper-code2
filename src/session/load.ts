export default async function (ctx: Context, _session: Session | null, opts: { id: string }): Promise<types.agent.Agent | null> {
    const { id } = opts;
    const rows = (await ctx.fns.procs.db.select({ sql: 'SELECT * FROM agents WHERE id = ? AND archived_at IS NULL', params: [id] })) as any[];
    const row = rows[0];
    if (!row) return null;

    const agent: types.agent.Agent = {
        id: row.id,
        model: row.model,
        systemPrompt: row.system_prompt,
        scratchpad: JSON.parse(row.scratchpad),
        messages: [],
        events: [],
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
