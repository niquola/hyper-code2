export default function (ctx: Context, id: string): any[] {
    const rows = ctx.fns.db.select<any>(ctx, 'SELECT * FROM messages WHERE agent_id = ? ORDER BY idx', [id]);
    return rows.map((r: any) => {
        const m: any = { role: r.role };
        if (r.content !== null) m.content = r.content;
        if (r.tool_calls !== null) m.tool_calls = JSON.parse(r.tool_calls);
        if (r.tool_call_id !== null) m.tool_call_id = r.tool_call_id;
        return m;
    });
}
