// A LIVE REGION: a fragment that re-fetches itself when the server says its
// topic changed.
//
// The whole contract is three attributes — where to re-fetch, which topic to
// watch, and how rarely to check anyway. There is no cursor and no client-side
// bookkeeping: the server sends "refresh agent:eh", the shared client re-asks
// for the regions carrying that topic, and the answer replaces them. Nothing
// can drift out of sync because nothing is remembered.
//
// The interval is a WATCHDOG, not the mechanism: it repairs a signal missed
// while the connection was down. Five seconds is the floor — a widget that
// wants a hot loop is asking for the wrong thing.
export default function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; url: string; topic: string; html?: string; every?: number; attrs?: string; tag?: string; swap?: string; trigger?: string },
): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const every = Math.max(5, opts.every ?? 30);
    const tag = /^[a-z][a-z0-9-]*$/i.test(opts.tag ?? '') ? opts.tag! : 'div';
    const swap = opts.swap ?? 'outerHTML';
    const trigger = [opts.trigger, 'hyper-live from:body', `every ${every}s`].filter(Boolean).join(', ');
    return `<${tag} id="${esc(opts.id)}"`
        + ` hx-get="${esc(opts.url)}"`
        + ` hx-trigger="${esc(trigger)}"`
        + ` hx-swap="${esc(swap)}"`
        + ` data-live-topic="${esc(opts.topic)}"`
        + `${opts.attrs ? " " + opts.attrs : ""}>${opts.html ?? ""}</${tag}>`;
}
