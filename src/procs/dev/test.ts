// Run the test suite (bun test) from the REPL — symmetric with dev.typecheck.
// Spawns a separate `bun test` process (own registry, doesn't touch the live
// server), returns pass/fail + the tail of the output.
//   ctx.fns.procs.dev.test({})                 → whole suite
//   ctx.fns.procs.dev.test({ filter: "math" }) → bun test's path/name filter
export default async function (ctx: Context, _session: Session | null, opts?: { filter?: string }) {
    const args = ["test", ...(opts?.filter ? [opts.filter] : [])];
    const proc = Bun.spawn(["bun", ...args], {
        cwd: ctx.fns.procs.project.projectRoot({}), // the app's root (its tests), not proc's
        stdout: "pipe",
        stderr: "pipe",
    });
    const [out, err] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
    ]);
    await proc.exited;
    const tail = (out + err).trim().split("\n").slice(-30).join("\n");
    return { ok: proc.exitCode === 0, exitCode: proc.exitCode, output: tail };
}
