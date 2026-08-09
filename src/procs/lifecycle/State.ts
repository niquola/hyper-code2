// ctx.state.procs.lifecycle — which modules have started, in the order they did,
// and which refused to. A failure is remembered rather than fatal: a host mounts
// modules it did not write, and one of them being unconfigured is not a reason to
// have no host. `procs/*` and anything declared `"required": true` still are.
export type State = { started: string[]; failed: Record<string, string> };
