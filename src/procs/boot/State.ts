// ctx.state.procs.boot — how this process was assembled: the table of loaders
// keyed by kind, and the file list they were applied to (a production build
// hands that list in instead of scanning for it).
export type State = { loaders?: Record<string, Function>; entries?: any[] };
