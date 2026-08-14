/** Get sleep generation for the runtime.  * @param opts.sleepContext Persisted sleep context.
 * @param opts.revision Optional sleep-context revision.
 * @param opts.kind Result or generation category.
*/
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Sleep context used by the operation. */
    sleepContext: any;
        /** Revision used by the operation. */
    revision?: number | null;
        /** Kind used by the operation. */
    kind?: "active" | "draft" | "latest" },
): any | null {
    const sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: opts.sleepContext });
    if (!sleep) return null;
    const revision = opts.revision != null
        ? Number(opts.revision)
        : opts.kind === "draft" ? sleep.draftRevision
        : opts.kind === "latest" ? Math.max(0, ...sleep.generations.map((x: any) => Number(x.revision)))
        : sleep.activeRevision;
    return sleep.generations.find((x: any) => Number(x.revision) === Number(revision)) ?? null;
}
