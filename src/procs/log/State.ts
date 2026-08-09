// ctx.state.procs.log — how this process logs: what passes the gate, in which
// shape, under whose name. Set by log/$start from config; a fork gets its own.
export type State = { level: number; format: "pretty" | "json"; service: string };
