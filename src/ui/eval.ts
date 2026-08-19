/**
 * Evaluates JavaScript in the currently connected Hyper UI page.
 * Use this only for current-page DOM inspection and interaction. It is not
 * browser automation: for navigation, new tabs, arbitrary websites, or a
 * verified Chrome target use `ctx.fns.browser.*` or `ctx.fns.screen.openTab`.
 * `window.open` through this UI transport may be blocked or affect the current
 * page, so it must not be used to open a new browser tab.
 *
 * @param opts.code JavaScript source evaluated by the active Hyper UI page.
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
