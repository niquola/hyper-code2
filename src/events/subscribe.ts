// Register a handler for server-side events. Returns an unsubscribe fn.
export default function (ctx: Context, opts: { handler: (e: any) => void }): () => void {
    const handler = opts.handler;
    const s = (ctx.state as any).events ?? ((ctx.state as any).events = { subs: new Set() });
    s.subs.add(handler);
    return () => s.subs.delete(handler);
}
