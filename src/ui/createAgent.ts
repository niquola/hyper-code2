const EVAL_CODE_TOOL = {
    name: 'evalCode',
    description: 'Execute a JavaScript expression or statements. Returns the serialized result.',
    parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'JS code to evaluate' } },
        required: ['code'],
    },
};

export default async function (ctx: Context, opts: { model?: string; systemPrompt?: string; tools?: any[]; open?: boolean; startText?: string } = {}) {
    const model = (opts.model ?? ctx.env.MODEL ?? 'minimax/minimax-m2.7').trim();
    const systemPrompt = opts.systemPrompt ?? await ctx.fns.agent.systemPrompt(ctx);
    const tools = opts.tools ?? [EVAL_CODE_TOOL];
    const agent = ctx.fns.agent.start(ctx, { model, systemPrompt, tools });
    try { ctx.fns.session?.save?.(ctx, agent); } catch (e: any) { console.error('[session.save]', e?.message); }
    if (opts.open !== false) ctx.fns.events.emit(ctx, { type: 'ui.navigate', path: '/agent/' + encodeURIComponent(agent.id) });
    if (opts.startText?.trim()) {
        const text = opts.startText.trim();
        const offset = agent.events.length;
        agent.events.push({ type: 'user', text });
        agent.isStreaming = true;
        queueMicrotask(async () => {
            try { await ctx.fns.agent.run(ctx, agent, text); }
            catch (e: any) { agent.events.push({ type: 'error', error: e.message }); }
            finally { agent.isStreaming = false; }
        });
        return { id: agent.id, model: agent.model, opened: opts.open !== false, started: true, offset };
    }
    return { id: agent.id, model: agent.model, opened: opts.open !== false, started: false };
}
