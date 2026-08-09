export default async function (ctx: Context, _session: Session | null, opts: { id: string }) {
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    return pending.pending.get(opts.id) ?? null;
}
