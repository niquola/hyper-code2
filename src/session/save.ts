/** Save for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Live agent instance to operate on. */
agent: types.agent.Agent }): Promise<void> {
    const { agent } = opts;
    const now = Date.now();
    await ctx.fns.procs.db.run({
        sql: `
        INSERT INTO agents (id, title, workspace_dir, model, system_prompt, tools, scratchpad, reflection, sleep_context, goal, reflection_enabled, sleep_enabled, status_line, status_line_every, parent_id, fork_offset, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM agents WHERE id = ?), ?), ?)
        ON CONFLICT(id) DO UPDATE SET
            model = excluded.model,
            title = excluded.title,
            workspace_dir = excluded.workspace_dir,
            system_prompt = excluded.system_prompt,
            tools = excluded.tools,
            scratchpad = excluded.scratchpad,
            parent_id = excluded.parent_id,
            reflection = excluded.reflection,
            fork_offset = excluded.fork_offset,
            sleep_context = excluded.sleep_context,
            goal = excluded.goal,
            reflection_enabled = excluded.reflection_enabled,
            sleep_enabled = excluded.sleep_enabled,
            status_line = excluded.status_line,
            status_line_every = excluded.status_line_every,
            updated_at = excluded.updated_at
    `,
        params: [
            agent.id,
            agent.title ?? "",
            agent.workspaceDir || process.cwd(),
            agent.model,
            agent.systemPrompt,
            agent.tools?.length ? JSON.stringify(agent.tools) : null,
            JSON.stringify(agent.scratchpad ?? {}),
            agent.reflection == null ? null : JSON.stringify(agent.reflection),
            agent.sleepContext == null ? null : JSON.stringify(agent.sleepContext),
            agent.goal == null ? null : JSON.stringify(agent.goal),
            agent.reflectionEnabled !== false,
            agent.sleepEnabled !== false,
            agent.statusLine ?? "",
            Math.max(1, Number(agent.statusLineEvery ?? 1)),
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
            sql: 'INSERT INTO messages (agent_id, idx, role, content, tool_calls, tool_call_id, message_type, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            params: [
                agent.id,
                idx,
                message.role,
                typeof message.content === 'string' ? message.content : (message.content == null ? null : JSON.stringify(message.content)),
                message.tool_calls?.length ? JSON.stringify(message.tool_calls) : null,
                message.tool_call_id ?? null,
                message.message_type ?? 'message',
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
