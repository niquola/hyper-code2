// Register a handler for server-side events → an unsubscribe fn.
//
// `topics` narrows what this subscriber hears, and the filtering happens HERE,
// on the server: a tab watching one agent should not be woken by every other
// agent's traffic. A subscriber that names no topics keeps hearing plain
// broadcasts, which is what everything did before topics existed.
export default function (
    ctx: Context,
    _session: Session | null,
    opts: { handler: (e: any) => void; topics?: string[] },
): () => void {
    const subs = ((ctx.state.procs.events ??= {}) as any).subs ??= new Set();
    const entry = opts.topics?.length ? { handler: opts.handler, topics: opts.topics } : opts.handler;
    subs.add(entry);
    return () => subs.delete(entry);
}
