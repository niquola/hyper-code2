// Internal DuckDB CLI runner. stdout is JSON; stderr/exit status stay explicit.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { sql: string; db?: string; timeout?: number },
): Promise<any[]> {
    const bin = ctx.env.DUCKDB_BIN || "duckdb";
    const db = opts.db ? ctx.fns.workspace.resolve({ path: opts.db }) : ":memory:";
    const proc = Bun.spawn([bin, "-json", db, "-c", opts.sql], { stdout: "pipe", stderr: "pipe" });
    const timeout = Math.max(1, Math.min(Number(opts.timeout ?? 30), 300));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timed = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { try { proc.kill(9); } catch {} reject(new Error(`duckdb timed out after ${timeout}s`)); }, timeout * 1000);
    });
    try {
        const [stdout, stderr, exitCode] = await Promise.race([
            Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]),
            timed,
        ]);
        if (exitCode !== 0) throw new Error(`duckdb exit ${exitCode}: ${stderr.trim() || stdout.trim()}`);
        const text = stdout.trim();
        return text ? JSON.parse(text) : [];
    } finally {
        if (timer) clearTimeout(timer);
    }
}
