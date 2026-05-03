// Fire an event to every live SSE subscriber. No-op if nobody is listening.
// Events are plain JSON — shape is `{ type: string, ... }`.
export default function (ctx: Context, opts: { event: any }): void {
    const event = opts.event;
    const s = (ctx.state as any).events ?? ((ctx.state as any).events = { subs: new Set() });
    for (const fn of s.subs) {
        try { fn(event); } catch { /* dead subscriber; ignore */ }
    }
}
