// Run a shell snippet in the agent's workspace. Secret references are resolved
// into child-process environment variables and redacted from captured output.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        command: string;
        cwd?: string;
        env?: Record<string, string>;
        secrets?: Record<string, string>;
        timeout?: number;
    },
): Promise<{ output: string; isError: boolean }> {
    const secretEnv: Record<string, string> = {};
    const sensitive: string[] = [];

    for (const [name, ref] of Object.entries(opts.secrets ?? {})) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`invalid secret environment variable: ${name}`);
        if (!ref.startsWith("op://") && !ref.startsWith("env://")) {
            throw new Error(`secret ${name} must be an op:// or env:// reference`);
        }
        const value = await ctx.fns.secrets.resolve({ ref });
        if (!value) throw new Error(`secret ${name} could not be resolved`);
        secretEnv[name] = value;
        sensitive.push(value);
    }

    const result = await ctx.fns.agent.executeBash({
        code: opts.command,
        cwd: opts.cwd,
        env: { ...opts.env, ...secretEnv },
        timeout: opts.timeout,
    });

    // Longer values first avoids partial masking when one secret prefixes another.
    for (const value of [...new Set(sensitive)].sort((a, b) => b.length - a.length)) {
        result.output = result.output.replaceAll(value, "[REDACTED]");
    }
    return result;
}
