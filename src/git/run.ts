async function readAll(stream?: ReadableStream<Uint8Array> | null): Promise<string> {
    if (!stream) return "";
    return await new Response(stream).text();
}

/** Runs a Git command in a workspace directory. */
export default async function (
    _ctx: Context,
    session: Session | null,
    opts: { /** Command-line arguments. */ args: string[]; /** Git working directory. */ dir?: string; /** Value for allowFailure. */ allowFailure?: boolean },
): Promise<types.git.Result> {
    const args = opts.args;
    const proc = Bun.spawn(["git", ...args], {
        cwd: opts.dir ?? session?.agent?.workspaceDir ?? process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
        readAll(proc.stdout),
        readAll(proc.stderr),
        proc.exited,
    ]);
    const out = { ok: code === 0, code, stdout, stderr };
    if (!out.ok && !opts.allowFailure) throw new Error(stderr || stdout || `git exited with code ${code}`);
    return out;
}
