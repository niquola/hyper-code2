export default async function (ctx: Context, _session: Session | null, opts: { name: string; args?: any; agent?: any }) {
    const name = (opts.name ?? '').trim();
    if (!name) throw new Error('empty action name');
    const id = 'uiaction_' + Bun.randomUUIDv7().replace(/[^a-zA-Z0-9_]/g, '');
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    const entry: any = { id, status: 'pending', action: name, args: opts.args ?? null, createdAt: Date.now() };
    pending.pending.set(id, entry);
    ctx.fns.procs.events.emit({ event: { type: 'ui.action', id, name, args: opts.args ?? null } });
    return { id, dispatched: true };
}
