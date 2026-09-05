/**
 * Resolve the installed Claude Code CLI version for subscription request identity
 *
 * Returns an explicit environment override or detects the installed claude CLI version once per process. Use for Claude subscription user-agent headers so newly gated models do not fail because of a stale hard-coded client version.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {},
): Promise<string> {
    const explicit = String(ctx.env.CLAUDE_CODE_CLI_VERSION ?? "").trim();
        if (explicit) return explicit;
        const state = ((ctx.state as any).llm ??= {});
        if (state.claudeCodeCliVersion) return state.claudeCodeCliVersion;
        try {
            const home = ctx.env.HOME ?? process.env.HOME ?? "";
            const path = [`${home}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin", ctx.env.PATH ?? process.env.PATH ?? ""].filter(Boolean).join(":");
            const proc = Bun.spawnSync(["claude", "--version"], { stdout: "pipe", stderr: "ignore", env: { ...process.env, ...ctx.env, PATH: path } });
            const version = proc.exitCode === 0 ? proc.stdout.toString().match(/\b(\d+\.\d+\.\d+)\b/)?.[1] : undefined;
            if (version) return state.claudeCodeCliVersion = version;
        } catch {}
        return state.claudeCodeCliVersion = "2.1.260";
}
