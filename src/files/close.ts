// Remove a file path from the server-side "open tabs" list. Idempotent.
// Broadcasts `files.close` via SSE so every connected browser refreshes.
/** Closes a file in the shared open-file list. */
export default function (ctx: Context, _session: Session | null, opts: { /** Workspace-relative path. */ path: string }): string[] {
    const path = opts.path;
    // Shared with files.rgPath — the namespace may exist without `open`. See open.ts.
    const s = ((ctx.state as any).files ??= {});
    s.open = (s.open ?? []).filter((p: string) => p !== path);
    ctx.fns.procs?.events?.emit?.({ event: { type: "files.close", path } });
    return s.open;
}
