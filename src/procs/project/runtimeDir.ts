// Where a run keeps what it writes: the port, the REPL secret, the signing key,
// the http log, the bundled client scripts and the db. It is under WORKDIR
// because the run belongs to the project, not to this repo — two workspaces
// over two projects would otherwise overwrite each other's port and secret, and
// a fresh project would open with the previous one's transcript.
//
// Framework-alone (no WORKDIR) is unchanged: workdir is the repo, so this is
// the repo's own .runtime/.
/**
 * Perform runtime dir for the project subsystem.
 */
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return `${ctx.fns.procs.project.workdir({})}/.runtime`;
}
