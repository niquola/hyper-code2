// http module teardown — stop the Bun server (closing active connections), and
// take the port file with us if it is still ours.
//
// `.runtime/port` is how everything on this machine finds the run — the REPL
// client, the helper the agent uses. A run that leaves its number behind sends
// the next caller to a socket nobody is listening on, and the error that comes
// back ("connection refused", or worse, another run's answer) says nothing about
// why. Only our own number is removed: a run that started after us owns the file.
import { unlink } from "node:fs/promises";

/**
 * Stop the http subsystem and release its resources.
 */
export default async function (ctx: Context, _session: Session | null, _state?: any) {
    const s = ctx.state.procs?.http.server as any;
    if (s?.server?.stop) { s.server.stop(true); ctx.fns.procs.log.info({ event: "http.stopped", msg: "server stopped" }); }

    const file = `${ctx.fns.procs.project.runtimeDir({})}/port`;
    const written = (await Bun.file(file).text().catch(() => "")).trim();
    if (written && written === String(s?.port)) await unlink(file).catch(() => { /* already gone */ });
}
