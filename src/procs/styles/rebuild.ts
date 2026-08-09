// Recompile every registered stylesheet and tell open tabs to re-fetch them.
// Called after a hot-reload: a class introduced by the change is in the freshly
// built css, and the `styles` event bumps the <link> so it lands without a full
// page reload. Failures are logged, not thrown — a broken $style must not take
// dev.sync down with it.
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<void> {
    for (const style of ctx.state.procs?.styles ?? []) {
        try { await ctx.fns.procs.styles.build({ abs: style.abs, key: style.key, force: true }); }
        catch (error: any) { ctx.fns.procs.log.warn({ event: "styles.build", msg: String(error?.message ?? error) }); }
    }
    ctx.fns.procs.events.emit({ event: { type: "styles" } });
}
