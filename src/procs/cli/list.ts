// The available CLI commands (from $cli_*.ts files).
/**
 * List the cli subsystem operation.
 */
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return Object.keys(ctx.state.procs?.cli ?? {}).sort();
}
