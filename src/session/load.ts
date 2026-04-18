export default function (ctx: Context, id: string): types.agent.Agent | null {
    const rows = ctx.fns.db.select<any>(ctx, "SELECT * FROM agents WHERE id = ?", [id]);
    const row = rows[0];
    if (!row) return null;

    const msgRows = ctx.fns.db.select<any>(ctx, "SELECT * FROM messages WHERE agent_id = ? ORDER BY idx", [id]);
    const messages = msgRows.map((r: any) => {
        const m: any = { role: r.role };
        if (r.content !== null) m.content = r.content;
        if (r.tool_calls !== null) m.tool_calls = JSON.parse(r.tool_calls);
        if (r.tool_call_id !== null) m.tool_call_id = r.tool_call_id;
        return m;
    });

    const evRows = ctx.fns.db.select<any>(ctx, "SELECT payload FROM events WHERE agent_id = ? ORDER BY idx", [id]);
    const events = evRows.map((r: any) => JSON.parse(r.payload));

    return {
        id: row.id,
        model: row.model,
        systemPrompt: row.system_prompt,
        tools: JSON.parse(row.tools),
        scratchpad: JSON.parse(row.scratchpad),
        messages,
        events,
        cursors: {},
        subscribers: new Set(),
        waiters: [],
        isStreaming: false,
        abortController: null,
    };
}
