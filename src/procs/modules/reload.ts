// Re-read the manifest and remount everything: the whole point of the module
// system is that installing one is an edit to workspace.json plus this call —
// no restart, no lost chat session. Root fns live on the ROOT ctx, so walk up to
// it before reloading; a REPL eval runs two prototypes below.
/**
 * Reload the modules subsystem operation.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    let root: any = ctx;
    while (Object.getPrototypeOf(root) !== Object.prototype) root = Object.getPrototypeOf(root);

    await root.fns.procs.modules.fetch({});
    await root.fns.procs.boot.load({});
    const lint = await root.fns.procs.dev.lint({ silent: true });
    if (!lint.ok) throw new Error("modules rejected by lint:\n" + lint.errors.map((e: string) => "  ✗ " + e).join("\n"));
    await root.fns.procs.dev.genTypes({});
    await root.fns.procs.http.loadRoutes({});
    // Provider modules may have appeared/disappeared — rebuild the service cards
    // (manifest merges provides of asked-for modules into the service list).
    // Optional: `services` is a library a host mounts, and the framework alone
    // reloads perfectly well without it.
    await root.fns.services?.track?.({});
    // A mounted/removed module changes the tab strip; reload the open tabs so it
    // shows without anyone pressing anything. The manager's POST still returns the
    // strip out of band, so its own click updates instantly and the broadcast just
    // agrees with it.
    root.fns.procs.events.reload({});
    return root.fns.procs.modules.list({});
}
