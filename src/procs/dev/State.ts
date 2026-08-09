// ctx.state.procs.dev — the watcher's error board: the files that failed to load
// since the last successful one, by path. Every REPL answer carries it, so a
// stale function cannot quietly pass for a fresh one.
export type State = { errors?: Map<string, string> };
