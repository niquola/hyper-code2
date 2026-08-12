// Tell every tab watching `topic` to re-fetch what it shows of it.
//
// This is the whole live-update protocol: the server names a topic, the client
// re-requests the regions that carry it. No payload travels, so a page cannot
// render from a message it half-received; re-fetching is an ordinary GET, so it
// is idempotent; and a refresh never publishes anything, so it cannot feed
// itself. Missing a signal costs one watchdog interval, never correctness.
export default function (ctx: Context, _session: Session | null, opts: { topic: string; reason?: string }): void {
    ctx.fns.procs.events.emit({ topic: opts.topic, event: { type: "refresh", reason: opts.reason ?? null } });
}
