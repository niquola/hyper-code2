// Publish an event to the tabs that care.
//
//   emit({ topic: "agent:eh", event })   → only subscribers watching that topic
//   emit({ event })                      → everybody (reload, styles, …)
//
// A topic is an ADDRESS, nothing more. There are no sequence numbers: an event
// says "this changed", never "this changed at position N". Numbers lived in
// server memory, so a restart reset them while tabs remembered the old ones,
// and a region rendered at the new lower number looked permanently behind —
// which is how an idle page ended up making hundreds of requests a second.
// With nothing to compare, there is nothing to disagree about.
export default function (ctx: Context, _session: Session | null, opts: { event: any; topic?: string }): void {
    const subs: Set<any> = ((ctx.state.procs.events ??= {}) as any).subs ??= new Set();
    const topic = opts.topic;
    const event = topic ? { ...opts.event, topic } : opts.event;

    for (const sub of subs) {
        // A subscriber that named topics hears those plus anything global; one
        // that named none hears everything.
        const wanted: string[] | undefined = (sub as any).topics;
        if (topic && wanted && !wanted.includes(topic)) continue;
        try { ((sub as any).handler ?? sub)(event); } catch { /* dead subscriber; ignore */ }
    }
}
