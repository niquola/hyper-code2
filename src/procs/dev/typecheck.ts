// Run tsc --noEmit over the project and return diagnostics. The runtime
// (Bun.Transpiler) only STRIPS types — def/sync catch syntax errors but not
// type errors. This is the missing half: call after defining typed code.
//   ctx.fns.procs.dev.typecheck({})            → whole project
//   ctx.fns.procs.dev.typecheck({ filter: "notes/" }) → only matching diagnostics
/**
 * Type-check typecheck for the dev subsystem.
 * @param opts.filter The filter value used by the operation.
 */
export default async function (ctx: Context, _session: Session | null, opts?: { filter?: string }) {
    const proc = Bun.spawn(["bunx", "tsc", "--noEmit", "--pretty", "false"], {
        cwd: ctx.fns.procs.project.projectRoot({}), // the app's root (its tsconfig), not proc's
        stdout: "pipe",
        stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    let lines = out.split('\n').filter(l => l.trim());
    if (opts?.filter) lines = lines.filter(l => l.includes(opts.filter!));
    return { ok: lines.length === 0, errors: lines };
}
