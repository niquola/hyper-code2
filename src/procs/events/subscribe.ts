// Register a handler for server-side events. Returns an unsubscribe fn.
export default function (ctx: Context, _session: Session | null, opts: { handler: (e: any) => void }): () => void {
    const handler = opts.handler;
    const subs = ((ctx.state.procs.events ??= {}).subs ??= new Set());
    subs.add(handler);
    return () => subs.delete(handler);
}
