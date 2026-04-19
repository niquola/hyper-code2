// Register a handler for server-side events. Returns an unsubscribe fn.
export default function (ctx: Context, handler: (e: any) => void): () => void {
    const s = (ctx.state as any).events ?? ((ctx.state as any).events = { subs: new Set() });
    s.subs.add(handler);
    return () => s.subs.delete(handler);
}
