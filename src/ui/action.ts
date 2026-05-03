export default async function (ctx: Context, opts: { name: string; args?: any; agent?: any }) {
    const name = (opts.name ?? '').trim();
    if (!name) throw new Error('empty action name');
    const id = 'uiaction_' + Bun.randomUUIDv7().replace(/[^a-zA-Z0-9_]/g, '');
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    const entry: any = { id, status: 'pending', action: name, args: opts.args ?? null, createdAt: Date.now() };
    pending.pending.set(id, entry);
    ctx.fns.events.emit(ctx, { event: { type: 'ui.action', id, name, args: opts.args ?? null } });
    if (opts.agent) {
        opts.agent.scratchpad ??= {};
        opts.agent.scratchpad.uiAction ??= {};
        opts.agent.scratchpad.uiAction.last = { id, name, args: opts.args ?? null };
    }
    return { id, dispatched: true };
}
