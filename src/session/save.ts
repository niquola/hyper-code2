export default function (ctx: Context, opts: { agent: types.agent.Agent }): void {
    const { agent } = opts;
    const now = Date.now();
    ctx.fns.db.exec(ctx, {
        sql: `
        INSERT INTO agents (id, model, system_prompt, scratchpad, parent_id, fork_offset, created_at, updated_at)
        VALUES ($id, $model, $sp, $scratchpad, $parentId, $forkOffset, COALESCE((SELECT created_at FROM agents WHERE id = $id), $ts), $ts)
        ON CONFLICT(id) DO UPDATE SET
            model = excluded.model,
            system_prompt = excluded.system_prompt,
            scratchpad = excluded.scratchpad,
            parent_id = excluded.parent_id,
            fork_offset = excluded.fork_offset,
            updated_at = excluded.updated_at
    `,
        params: {
            $id: agent.id,
            $model: agent.model,
            $sp: agent.systemPrompt,
            $scratchpad: JSON.stringify(agent.scratchpad ?? {}),
            $parentId: agent.parentId ?? null,
            $forkOffset: agent.forkOffset ?? null,
            $ts: now,
        },
    });

    ctx.fns.db.exec(ctx, { sql: 'DELETE FROM messages WHERE agent_id = ?', params: [agent.id] });
    (agent.messages ?? []).forEach((message: any, idx: number) => {
        ctx.fns.db.exec(ctx, {
            sql: 'INSERT INTO messages (agent_id, idx, role, content, ts) VALUES (?, ?, ?, ?, ?)',
            params: [
                agent.id,
                idx,
                message.role,
                typeof message.content === 'string' ? message.content : (message.content == null ? null : JSON.stringify(message.content)),
                now + idx,
            ],
        });
    });

    ctx.fns.db.exec(ctx, { sql: 'DELETE FROM events WHERE agent_id = ?', params: [agent.id] });
    (agent.events ?? []).forEach((event: any, idx: number) => {
        ctx.fns.db.exec(ctx, { sql: 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', params: [agent.id, idx, event.type, JSON.stringify(event), now + idx] });
    });
}
