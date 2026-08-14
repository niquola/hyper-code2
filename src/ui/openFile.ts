/** Performs the ui.openFile runtime operation. */
/**
 * Open a workspace file in the browser UI.
 * @param opts.path Workspace-relative file path.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Workspace-relative path to open. */ path: string }) {
    const resolved = ctx.fns.files.resolveSafe({ path: opts.path });
    // files.open maintains the server-side tab list, but its historical event is
    // not a browser navigation command. Use the same ui.navigate transport as
    // openAgent so the visible tab actually moves to our Files screen.
    ctx.fns.files.open({ path: resolved, broadcast: false });
    const url = `/files?path=${encodeURIComponent(resolved)}`;
    ctx.fns.procs.events.emit({ event: { type: "ui.navigate", path: url } });
    return { opened: resolved, url };
}
