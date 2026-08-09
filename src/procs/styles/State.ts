// ctx.state.procs.styles — the compiled stylesheets, in the order the layout
// links them: the framework's leads, a module's cascades over it.
//
// `built` is the output this PROCESS compiled. A file on disk is not enough to
// call a sheet current: Tailwind reads class names out of the source, so any
// edit anywhere can change what belongs in it, and a build kept across restarts
// is how a class somebody just wrote has no rule behind it. Built once per run,
// and again on a hot reload.
export type State = Array<{ href: string; abs: string; key: string; built?: string }>;
