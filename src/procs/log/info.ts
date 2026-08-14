/**
 * Emits a structured informational log record.
 * @param opts.event Stable event name used for filtering and aggregation.
 * @param opts.msg Optional human-readable message; additional fields become structured attributes.
 */
export default function (ctx: Context, session: Session | null, opts: { event: string; msg?: string; [key: string]: any }) {
    const { event, msg, ...attrs } = opts;
    return ctx.fns.procs.log.emit({ severity: "info", event, msg, attrs });
}
