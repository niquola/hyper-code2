// Add a file path to the server-side "open tabs" list. Idempotent.
// Broadcasts `files.open` via SSE so every connected browser reacts
// (navigates to the file if on /files, or refreshes the sidebar otherwise).
// Both UI (GET /files?path=...) and the agent (via evalCode) can call this.
export default function (ctx: Context, path: string): string[] {
    if (!path) return ((ctx.state as any).files?.open ?? []) as string[];
    const s = (ctx.state as any).files ?? ((ctx.state as any).files = { open: [] });
    const wasOpen = s.open.includes(path);
    if (!wasOpen) s.open.push(path);
    ctx.fns.events?.emit?.(ctx, { type: "files.open", path });
    return s.open;
}
