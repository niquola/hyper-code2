// GET /agent/:id — the agent's overview page in the RIGHT pane. The chat
// itself lives in the layout's left column (ui.chatColumn); this route's job is
// to make :id the current agent (opts → layout sticky) and show its passport.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = (await ctx.fns.session?.load?.({ id })) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return new Response('Not Found', { status: 404 });
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });

    const row = ((await ctx.fns.procs.db.select({
        sql: `SELECT model, created_at, updated_at, parent_id, fork_offset, run_state,
                     (SELECT COUNT(*) FROM messages WHERE agent_id = agents.id) AS msgs,
                     (SELECT COUNT(*) FROM messages WHERE agent_id = agents.id AND role = 'user' AND excluded_from_cursor = 0) AS turns
                FROM agents WHERE id = ?`,
        params: [id],
    })) as any[])[0] ?? {};
    const children = (await ctx.fns.procs.db.select({
        sql: 'SELECT id FROM agents WHERE parent_id = ? AND archived_at IS NULL',
        params: [id],
    })) as any[];
    const scratchKeys = Object.keys(agent.scratchpad ?? {});
    const prompt = String(agent.systemPrompt ?? '').slice(0, 2000);

    const dt = (v: any) => v ? new Date(Number(v)).toLocaleString() : '—';
    const fact = (k: string, v: string) => `<div class="flex gap-2 text-sm"><span class="w-28 shrink-0 text-gray-400">${k}</span><span class="min-w-0 break-all">${v}</span></div>`;

    const main = `
<div ${ctx.fns.procs.ui.attr({ page: "agent", id })} class="p-8 max-w-3xl">
  <div class="flex items-center gap-3 mb-6">
    <h1 class="text-xl font-semibold font-mono">${esc(id)}</h1>
    <span class="text-xs px-2 py-0.5 rounded-full border ${row.run_state === 'running' ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}">${esc(row.run_state ?? 'idle')}</span>
    <div class="ml-auto flex gap-2">
      <form method="POST" action="/agent/${encodeURIComponent(id)}/fork" hx-boost="false"><button ${ctx.fns.procs.ui.attr({ action: "fork", id })} class="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">fork</button></form>
      <form method="POST" action="/agent/${encodeURIComponent(id)}/archive" hx-boost="false"><button ${ctx.fns.procs.ui.attr({ action: "archive", id })} class="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">archive</button></form>
      <form method="POST" action="/agent/${encodeURIComponent(id)}/delete" hx-boost="false" onsubmit="return confirm('delete this agent?')"><button ${ctx.fns.procs.ui.attr({ action: "delete", id })} class="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">delete</button></form>
    </div>
  </div>
  <div class="space-y-1.5 mb-6">
    ${fact('model', `<span class="font-mono">${esc(agent.model)}</span>`)}
    ${fact('created', esc(dt(row.created_at)))}
    ${fact('updated', esc(dt(row.updated_at)))}
    ${fact('messages', `${Number(row.msgs ?? 0)} total · ${Number(row.turns ?? 0)} user turns`)}
    ${row.parent_id ? fact('forked from', `<a class="text-blue-700 hover:underline font-mono" hx-boost="false" href="/agent/${encodeURIComponent(row.parent_id)}">${esc(row.parent_id)}</a> @ msg ${Number(row.fork_offset ?? 0)}`) : ''}
    ${children.length ? fact('forks', children.map((c: any) => `<a class="text-blue-700 hover:underline font-mono mr-2" hx-boost="false" href="/agent/${encodeURIComponent(c.id)}">${esc(c.id)}</a>`).join('')) : ''}
    ${scratchKeys.length ? fact('scratchpad', esc(scratchKeys.join(', '))) : ''}
    ${fact('search', `<a class="text-blue-700 hover:underline" href="/search?agent=${encodeURIComponent(id)}">BM25 in this transcript →</a>`)}
  </div>
  ${prompt ? `<div class="text-xs text-gray-400 mb-1">system prompt (custom part)</div>
  <pre class="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap max-h-80 overflow-y-auto">${esc(prompt)}</pre>` : ''}
</div>`;

    return { currentId: id, title: id, main };
}
