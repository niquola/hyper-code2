export default async function (ctx: Context, _session: Session | null, opts: { agent: types.agent.Agent }): Promise<void> {
    const { agent } = opts;
    const now = Date.now();
    await ctx.fns.procs.db.run({
        sql: `
        INSERT INTO agents (id, title, workspace_dir, model, system_prompt, scratchpad, parent_id, fork_offset, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM agents WHERE id = ?), ?), ?)
        ON CONFLICT(id) DO UPDATE SET
            model = excluded.model,
            title = excluded.title,
            workspace_dir = excluded.workspace_dir,
            system_prompt = excluded.system_prompt,
            scratchpad = excluded.scratchpad,
            parent_id = excluded.parent_id,
            fork_offset = excluded.fork_offset,
            updated_at = excluded.updated_at
    `,
        params: [
            agent.id,
            agent.title ?? "",
            agent.workspaceDir || process.cwd(),
            agent.model,
            agent.systemPrompt,
            JSON.stringify(agent.scratchpad ?? {}),
            agent.parentId ?? null,
            agent.forkOffset ?? null,
            agent.id,
            now,
            now,
        ],
    });

    await ctx.fns.procs.db.run({ sql: 'DELETE FROM messages WHERE agent_id = ?', params: [agent.id] });
    const messages: any[] = agent.messages ?? [];
    for (let idx = 0; idx < messages.length; idx++) {
        const message: any = messages[idx];
        await ctx.fns.procs.db.run({
            sql: 'INSERT INTO messages (agent_id, idx, role, content, ts) VALUES (?, ?, ?, ?, ?)',
            params: [
                agent.id,
                idx,
                message.role,
                typeof message.content === 'string' ? message.content : (message.content == null ? null : JSON.stringify(message.content)),
                now + idx,
            ],
        });
    }

    await ctx.fns.procs.db.run({ sql: 'DELETE FROM events WHERE agent_id = ?', params: [agent.id] });
    const events: any[] = agent.events ?? [];
    for (let idx = 0; idx < events.length; idx++) {
        const event: any = events[idx];
        await ctx.fns.procs.db.run({ sql: 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', params: [agent.id, idx, event.type, JSON.stringify(event), now + idx] });
    }
}
