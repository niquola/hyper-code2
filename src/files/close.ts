// Remove a file path from the server-side "open tabs" list. Idempotent.
// Broadcasts `files.close` via SSE so every connected browser refreshes.
export default function (ctx: Context, _session: Session | null, opts: { path: string }): string[] {
    const path = opts.path;
    const s = (ctx.state as any).files ?? ((ctx.state as any).files = { open: [] });
    s.open = s.open.filter((p: string) => p !== path);
    ctx.fns.procs?.events?.emit?.({ event: { type: "files.close", path } });
    return s.open;
}
