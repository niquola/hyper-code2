/** Performs the ui.eval runtime operation. */
/**
 * Evaluate browser-side JavaScript through the active UI connection.
 * @param opts.code JavaScript source to evaluate in the browser.
 * @param opts.agent Agent associated with the operation.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** JavaScript or TypeScript source to evaluate. */ code: string;
        /** Agent associated with the operation. */ agent?: any }) {
    const code = (opts.code ?? '').trim();
    if (!code) throw new Error('empty code');
    const id = 'uieval_' + Bun.randomUUIDv7().replace(/[^a-zA-Z0-9_]/g, '');
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    const entry: any = { id, status: 'pending', code, createdAt: Date.now() };
    pending.pending.set(id, entry);
    ctx.fns.procs.events.emit({ event: { type: 'ui.eval', id, code } });
    return { id, dispatched: true };
}
