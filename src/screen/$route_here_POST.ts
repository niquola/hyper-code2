// POST /screen/here — the open tab saying where it is.
//
// `readScreen` asks and waits: it pushes code down the event stream, the browser
// answers, and the round trip only works while somebody has the page open. That
// is right for "what exactly is on screen", and far too heavy for "where is the
// person" — a question worth answering before every single reply.
//
// So the tab volunteers it: one beacon per settle, no answer wanted, and the
// server keeps the last one. It is a fact about a browser, so it can be stale by
// a click; anything that must be exact still asks.
/**
 * Receives the browser’s current screen state.
 * @param opts.req Incoming HTTP request.
 */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const said: any = await opts.req.json().catch(() => null);
    if (said?.url) {
        (ctx.state.screen ??= { nextId: 1, pending: new Map() } as any).here = {
            url: String(said.url), title: String(said.title ?? ""), page: said.page ?? null,
            at: new Date().toISOString(),
        };
    }
    return new Response(null, { status: 204 });
}
