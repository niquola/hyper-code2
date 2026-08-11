// Run a shell snippet in the agent's workspace. Declared as a tool by
// $tool_bash.md; callable by hand as ctx.fns.tools.bash({ command, timeout }).
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { command: string; cwd?: string; env?: Record<string, string>; timeout?: number },
): Promise<{ output: string; isError: boolean }> {
    return await ctx.fns.agent.executeBash({
        code: opts.command,
        cwd: opts.cwd,
        env: opts.env,
        timeout: opts.timeout,
    });
}
