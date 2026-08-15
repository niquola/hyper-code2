/** Starts best-effort indexing of live runtime function documentation. */
export default async function (ctx: Context, _session: Session | null, _config?: unknown): Promise<void> {
    queueMicrotask(() => {
        ctx.fns.runtime.docs.index({}).then((result: any) => {
            if (result.failed) ctx.fns.procs.log.warn({ event: "runtime.docs.index.degraded", msg: result.failed });
            else ctx.fns.procs.log.info({ event: "runtime.docs.indexed", msg: `${result.indexed} function(s), ${result.embedded} embedded` });
        }).catch((error: any) => {
            // Search has an in-memory fallback; indexing can never make boot fail.
            ctx.fns.procs.log.warn({ event: "runtime.docs.index.failed", msg: String(error?.message ?? error) });
        });
    });
}
