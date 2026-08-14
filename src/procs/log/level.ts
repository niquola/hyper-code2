// Get or set the log level on the current ctx.
// ctx.fns.procs.log.level()                  → { level: 2, name: "info" }
// ctx.fns.procs.log.level({ set: "debug" })  → { level: 3, name: "debug" }
const LEVELS: Record<string, number> = { off: -1, error: 0, warn: 1, info: 2, debug: 3 };
const NAMES: Record<number, string> = { [-1]: "off", 0: "error", 1: "warn", 2: "info", 3: "debug" };

/**
 * Perform level for the log subsystem.
 * @param opts.set Values assigned by the operation.
 */
export default function (ctx: Context, _session: Session | null, opts?: { set?: string | number }) {
    const st = (ctx.state.procs.log ??= { level: 2, format: "pretty", service: "procs" });
    if (opts?.set !== undefined) {
        st.level = typeof opts.set === "string" ? (LEVELS[opts.set] ?? 2) : opts.set;
    }
    return { level: st.level, name: NAMES[st.level] ?? "off" };
}
