// Bridge into the LIVE uniskill runtime (~/uniskill) — the user's second procs
// server with all its skills mounted: consensus, telegram, docs, kb, arxiv,
// browser/CDP, pg and the rest. Code runs THERE (their auth: Chrome cookies,
// secrets, their Postgres) via the same tokened /procs/repl every procs app
// ships; we read its port+token from uniskill's .runtime.
//   ctx.fns.uni.eval({ code: 'await ctx.fns.docs.search({ q: "fhir" })' })
// Returns { output, return } — console output plus the last expression.
const UNISKILL_RUNTIME = `${process.env.HOME}/uniskill/.runtime`;

export default async function (
    _ctx: Context,
    _session: Session | null,
    opts: { code: string; timeoutMs?: number },
): Promise<{ output: string; return: any }> {
    const port = (await Bun.file(`${UNISKILL_RUNTIME}/port`).text().catch(() => "")).trim();
    if (!port) throw new Error("uniskill server is not running (no ~/uniskill/.runtime/port)");
    const token = (await Bun.file(`${UNISKILL_RUNTIME}/repl-token`).text().catch(() => "")).trim();

    const res = await Promise.race([
        fetch(`http://localhost:${port}/procs/repl`, {
            method: "POST",
            headers: token ? { authorization: `Bearer ${token}` } : {},
            body: opts.code,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("uniskill repl timed out")), opts.timeoutMs ?? 60_000)),
    ]);
    const data: any = await res.json().catch(async () => ({ error: await res.text() }));
    if (!res.ok || data.error) throw new Error(`uniskill: ${data.error ?? res.status}${data.next ? ` — ${data.next}` : ""}`);
    return { output: String(data.output ?? ""), return: data.return };
}
