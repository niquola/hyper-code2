/** Performs the ui.pending runtime operation. */
/**
 * Render a pending placeholder for asynchronously loaded UI content.
 * @param opts.id Stable DOM region identifier.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Identifier of the target agent. */ id: string }) {
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    return pending.pending.get(opts.id) ?? null;
}
