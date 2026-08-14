// Inject JS into the open workspace page and wait for its result. The code is
// the body of an async function in the tab; the last expression is returned.
//
// The event only reaches tabs that are subscribed *now* — a page that has just
// loaded has not finished connecting its event stream, and firing into that gap
// looks exactly like "no browser is open". So wait for a listener first, and
// send again once if the first attempt goes unanswered: a tab that reconnects
// mid-flight (the stream retries with a backoff) would otherwise miss its only
// chance.
/**
 * Evaluates code through the connected browser screen bridge.
 * @param opts.code Code to evaluate in the browser.
 * @param opts.timeoutMs Maximum wait in milliseconds.
 */
export default async function (ctx: Context, _session: Session | null, opts: { code: string; timeoutMs?: number }) {
    const page = (ctx.state.screen ??= { nextId: 1, pending: new Map() });
    const id = page.nextId++;
    const timeout = opts.timeoutMs ?? 10_000;

    for (let waited = 0; !listeners(ctx) && waited < 3_000; waited += 50) await Bun.sleep(50);

    const answer = new Promise((resolve, reject) => {
        page.pending.set(id, { resolve, reject });
        setTimeout(() => {
            if (page.pending.has(id)) ctx.fns.procs.events.emit({ event: { type: "eval", id, code: opts.code } });
        }, Math.min(1_500, timeout / 3));
        setTimeout(() => {
            if (!page.pending.delete(id)) return;
            reject(new Error(listeners(ctx) ? `the page did not answer in ${timeout}ms` : "no page answered — is the workspace UI open in a browser?"));
        }, timeout);
    });

    ctx.fns.procs.events.emit({ event: { type: "eval", id, code: opts.code } });
    return answer;
}

function listeners(ctx: Context): number {
    return ctx.state.procs.events?.subs?.size ?? 0;
}
