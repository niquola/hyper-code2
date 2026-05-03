export default async function (ctx: Context, opts: { code: string; agent?: any }) {
    const code = (opts.code ?? '').trim();
    if (!code) throw new Error('empty code');
    const id = 'uieval_' + Bun.randomUUIDv7().replace(/[^a-zA-Z0-9_]/g, '');
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    const entry: any = { id, status: 'pending', code, createdAt: Date.now() };
    pending.pending.set(id, entry);
    ctx.fns.events.emit(ctx, { event: { type: 'ui.eval', id, code } });
    if (opts.agent) {
        opts.agent.scratchpad ??= {};
        opts.agent.scratchpad.uiEval ??= {};
        opts.agent.scratchpad.uiEval.last = { id, code };
    }
    return { id, dispatched: true };
}
