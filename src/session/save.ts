export default function (ctx: Context, agent: types.agent.Agent): void {
    const db = (ctx.state as any).db;
    if (!db) throw new Error("db not connected — call ctx.fns.db.connect first");
    const now = Date.now();

    db.transaction(() => {
        ctx.fns.db.exec(ctx, `
            INSERT INTO agents (id, model, system_prompt, tools, scratchpad, created_at, updated_at)
            VALUES ($id, $model, $sp, $tools, $scratchpad, $ts, $ts)
            ON CONFLICT(id) DO UPDATE SET
                model = excluded.model,
                system_prompt = excluded.system_prompt,
                tools = excluded.tools,
                scratchpad = excluded.scratchpad,
                updated_at = excluded.updated_at
        `, {
            $id: agent.id,
            $model: agent.model,
            $sp: agent.systemPrompt,
            $tools: JSON.stringify(agent.tools ?? []),
            $scratchpad: JSON.stringify(agent.scratchpad ?? {}),
            $ts: now,
        });

        ctx.fns.db.exec(ctx, "DELETE FROM messages WHERE agent_id = ?", [agent.id]);
        ctx.fns.db.exec(ctx, "DELETE FROM events WHERE agent_id = ?", [agent.id]);

        agent.messages.forEach((m: any, i: number) => {
            ctx.fns.db.exec(ctx, `
                INSERT INTO messages (agent_id, idx, role, content, tool_calls, tool_call_id, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                agent.id,
                i,
                m.role,
                typeof m.content === "string" ? m.content : (m.content == null ? null : JSON.stringify(m.content)),
                m.tool_calls ? JSON.stringify(m.tool_calls) : null,
                m.tool_call_id ?? null,
                now,
            ]);
        });

        agent.events.forEach((e: any, i: number) => {
            ctx.fns.db.exec(ctx, "INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)",
                [agent.id, i, e.type, JSON.stringify(e), now]);
        });
    })();
}
