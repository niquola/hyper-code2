export default function (ctx: Context, agent: types.agent.Agent): void {
    const now = Date.now();
    ctx.fns.db.exec(ctx, `
        INSERT INTO agents (id, model, system_prompt, tools, scratchpad, parent_id, fork_offset, created_at, updated_at)
        VALUES ($id, $model, $sp, $tools, $scratchpad, $parentId, $forkOffset, COALESCE((SELECT created_at FROM agents WHERE id = $id), $ts), $ts)
        ON CONFLICT(id) DO UPDATE SET
            model = excluded.model,
            system_prompt = excluded.system_prompt,
            tools = excluded.tools,
            scratchpad = excluded.scratchpad,
            parent_id = excluded.parent_id,
            fork_offset = excluded.fork_offset,
            updated_at = excluded.updated_at
    `, {
        $id: agent.id,
        $model: agent.model,
        $sp: agent.systemPrompt,
        $tools: JSON.stringify(agent.tools ?? []),
        $scratchpad: JSON.stringify(agent.scratchpad ?? {}),
        $parentId: agent.parentId ?? null,
        $forkOffset: agent.forkOffset ?? null,
        $ts: now,
    });

    ctx.fns.db.exec(ctx, 'DELETE FROM messages WHERE agent_id = ?', [agent.id]);
    (agent.messages ?? []).forEach((message: any, idx: number) => {
        ctx.fns.db.exec(ctx, 'INSERT INTO messages (agent_id, idx, role, content, tool_calls, tool_call_id, ts) VALUES (?, ?, ?, ?, ?, ?, ?)', [
            agent.id,
            idx,
            message.role,
            typeof message.content === 'string' ? message.content : (message.content == null ? null : JSON.stringify(message.content)),
            message.tool_calls ? JSON.stringify(message.tool_calls) : null,
            message.tool_call_id ?? null,
            now + idx,
        ]);
    });

    ctx.fns.db.exec(ctx, 'DELETE FROM events WHERE agent_id = ?', [agent.id]);
    (agent.events ?? []).forEach((event: any, idx: number) => {
        ctx.fns.db.exec(ctx, 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', [agent.id, idx, event.type, JSON.stringify(event), now + idx]);
    });
}
