// Add a file path to the server-side "open tabs" list. Idempotent.
// Broadcasts `files.open` via SSE (unless `broadcast:false`) so every connected
// browser reacts — agent-initiated opens navigate the user's browser.
// The GET /files handler passes `broadcast:false` (the user is already navigating,
// no need to self-echo and re-navigate to the same URL).
export default function (
    ctx: Context,
    opts: { path: string; broadcast?: boolean },
): string[] {
    const path = opts.path;
    if (!path) return ((ctx.state as any).files?.open ?? []) as string[];
    const s = (ctx.state as any).files ?? ((ctx.state as any).files = { open: [] });
    if (!s.open.includes(path)) s.open.push(path);
    if (opts.broadcast !== false) {
        ctx.fns.events?.emit?.(ctx, { event: { type: "files.open", path } });
    }
    return s.open;
}
