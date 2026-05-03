export default async function (
    ctx: Context,
    opts: { model?: string; systemPrompt?: string; open?: boolean; startText?: string } = {},
) {
    // Priority: explicit opts.model > declared setting (DB → env → default).
    const fromSettings = ctx.fns?.settings?.getString?.(ctx, {
        module: 'llm', scopeType: 'global', key: 'defaultModel',
    });
    const model = (opts.model ?? fromSettings ?? 'minimax/minimax-m2.7').trim();
    const agent = ctx.fns.agent.start(ctx, {
        model,
        systemPrompt: opts.systemPrompt ?? '',
    });
    try { ctx.fns.session?.save?.(ctx, { agent }); } catch (e: any) { console.error('[session.save]', e?.message); }
    if (opts.open !== false) ctx.fns.events.emit(ctx, { event: { type: 'ui.navigate', path: '/agent/' + encodeURIComponent(agent.id) } });
    if (opts.startText?.trim()) {
        const text = opts.startText.trim();
        const offset = agent.events.length;
        agent.events.push({ type: 'user', text });
        agent.isStreaming = true;
        queueMicrotask(async () => {
            try { await ctx.fns.agent.run(ctx, { agent, userText: text }); }
            catch (e: any) { agent.events.push({ type: 'error', error: e.message }); }
            finally { agent.isStreaming = false; }
        });
        return { id: agent.id, model: agent.model, opened: opts.open !== false, started: true, offset };
    }
    return { id: agent.id, model: agent.model, opened: opts.open !== false, started: false };
}
