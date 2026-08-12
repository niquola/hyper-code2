// GET /events — long-lived Server-Sent Events stream.
// Every page opens one; the server pushes reload / custom events down it. The
// stream doubles as presence: it begins when a tab opens and ends when it
// closes, which is a better answer to "who is here" than anything a heartbeat
// could give.
// `?topics=agent:eh,agents` narrows the stream SERVER-side: a tab watching one
// agent is not woken by every other agent's traffic. Global events (reload,
// notify) still reach everybody — see procs.events.emit.
export default async function (ctx: Context, session: Session, opts: { req: Request }) {
    const topics = (new URL(opts.req.url).searchParams.get("topics") ?? "")
        .split(",").map(t => t.trim()).filter(Boolean);
    const stream = new ReadableStream({
        start(controller) {
            const enc = new TextEncoder();
            const send = (e: any) => {
                try { controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); }
                catch { unsub(); }
            };
            // A reconnecting tab may have missed signals while it was away, so
            // the greeting tells it to refresh what it shows — the same message
            // any change sends, which keeps recovery and normal operation on
            // one path instead of two.
            send({ type: "hello", serverStart: (ctx.state as any).serverStart, refresh: topics });
            const unsub = ctx.fns.procs.events.subscribe({ handler: send, topics });
            // The stream is also the presence: it lasts exactly as long as the tab.
            const leave = ctx.fns.procs.events.join({});
            const keepalive = setInterval(() => {
                try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { /* closed */ }
            }, 25_000);
            opts.req.signal.addEventListener("abort", () => {
                clearInterval(keepalive);
                leave();
                unsub();
                try { controller.close(); } catch { /* already closed */ }
            });
        },
    });
    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
        },
    });
}
