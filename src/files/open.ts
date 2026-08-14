// Add a file path to the server-side "open tabs" list. Idempotent.
// Broadcasts `files.open` via SSE (unless `broadcast:false`) so every connected
// browser reacts — agent-initiated opens navigate the user's browser.
// The GET /files handler passes `broadcast:false` (the user is already navigating,
// no need to self-echo and re-navigate to the same URL).
/** Adds a file to the shared open-file list. */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Workspace-relative path. */ path: string; /** Value for broadcast. */ broadcast?: boolean },
): string[] {
    const path = opts.path;
    // `ctx.state.files` is shared with files.rgPath, which creates it to cache the
    // ripgrep lookup. So the namespace can already exist with no `open` list in
    // it — any grep before the first open used to make this throw on
    // `s.open.includes`, taking the whole /files page down with it.
    const s = ((ctx.state as any).files ??= {});
    s.open ??= [];
    if (!path) return s.open as string[];
    if (!s.open.includes(path)) s.open.push(path);
    if (opts.broadcast !== false) {
        ctx.fns.procs?.events?.emit?.({ event: { type: "files.open", path } });
    }
    return s.open;
}
