// `$hook_<name>.ts` — a handler for a named extension point, filed under that
// name with the module as its id. One name, many answers: `hooks.run` fans out,
// `hooks.first` takes the first that answers.

/**
 * Load loader hook declarations into the runtime.
 * @param opts.entries The loader entries to register.
 */
export default async function (ctx: Context, _session: Session | null, opts: { entries: any[] }): Promise<void> {
    for (const entry of opts.entries) {
        const handler = entry.fn ?? (await import(entry.abs + `?t=${Date.now()}`)).default;
        if (typeof handler !== "function") continue;
        const handlers = ((ctx.state.procs.hooks ??= {}).handlers ??= {});
        (handlers[entry.hookName] ??= new Map())// The answerer is the module the file is in; a file at the src root
        // belongs to the app itself.
        .set(entry.moduleDir === "." ? "app" : entry.moduleDir, handler);
    }
}
