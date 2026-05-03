// GET /events — long-lived Server-Sent Events stream.
// Every page opens one; server pushes `files.open` / `files.close` etc.
export default async function (ctx: Context, _session: any, req: Request) {
    const stream = new ReadableStream({
        start(controller) {
            const enc = new TextEncoder();
            const send = (e: any) => {
                try { controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); }
                catch { unsub(); }
            };
            send({ type: "hello" });
            const unsub = ctx.fns.events.subscribe(ctx, { handler: send });
            const keepalive = setInterval(() => {
                try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { /* closed */ }
            }, 25_000);
            req.signal.addEventListener("abort", () => {
                clearInterval(keepalive);
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
