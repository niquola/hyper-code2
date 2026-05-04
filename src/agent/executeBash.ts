// Run a shell snippet from a §bash marker. Async (Bun.spawn, not spawnSync)
// so a long-running command doesn't block the event loop and freeze every
// other concurrent agent's LLM stream for the duration of the shell command.
//
// Output shape mirrors the agent's expectations:
// - exit 0 + stdout only:                 return stdout
// - exit 0 + stderr only:                 return "stderr:\n<stderr>"
// - exit 0 + stdout + stderr:             return "<stdout>\nstderr:\n<stderr>"
// - exit !=0:                             return "[exit N]\n" + stderr/stdout blocks
export default async function (
    _ctx: Context,
    opts: { code: string },
): Promise<{ output: string; isError: boolean }> {
    const { code } = opts;
    const proc = Bun.spawn({
        cmd: ['bash', '-c', code],
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const [stdoutText, stderrText, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    const stdout = stdoutText.trimEnd();
    const stderr = stderrText.trimEnd();

    if (exitCode !== 0) {
        const parts = [`[exit ${exitCode}]`];
        if (stderr) parts.push('stderr:\n' + stderr);
        if (stdout) parts.push('stdout:\n' + stdout);
        return { output: parts.join('\n'), isError: true };
    }

    if (stdout && stderr) {
        return {
            output: `${stdout}\nstderr:\n${stderr}`,
            isError: false,
        };
    }

    if (stdout) {
        return { output: stdout, isError: false };
    }

    if (stderr) {
        return { output: `stderr:\n${stderr}`, isError: false };
    }

    return {
        output: '(no output)',
        isError: false,
    };
}