// What is mounted right now, with each module's faces (see $state_modules.ts).
// loadFns builds these records; this is just the door the agent and the manager
// knock on, so there is one answer and no second scan.
/**
 * List the modules subsystem operation.
 */
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return ctx.state.procs?.modules ?? [];
}
