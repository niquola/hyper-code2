// POST /screen/result — a tab answering an injected evaluation.
export default async function (ctx: Context, _session: Session, opts: { req: Request }) {
    const { id, value, error } = await opts.req.json() as { id: number; value?: any; error?: string };
    const waiter = ctx.state.screen?.pending.get(id);
    if (!waiter) return { ignored: id };
    ctx.state.screen.pending.delete(id);
    error ? waiter.reject(new Error(error)) : waiter.resolve(value);
    return { ok: true };
}
