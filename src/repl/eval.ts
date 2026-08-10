// Agent-facing eval: wraps procs.repl.eval with the §eval contract —
//   - `agent` is bound in scope when given (the running agent object)
//   - the result is the captured console/print output as ONE plain string
//     (the body of the §result:eval message), "(no output)" when silent.
//   - a parse error is DIAGNOSED: models glue trailing prose onto the body
//     ("…console.log(x);  ok now check tests" — the cm pattern), and a bare
//     "Parse error" teaches nothing. If the code parses once trailing lines
//     are dropped, the error names the first non-code line and the fix.
const DIAG_TRANSPILER = new Bun.Transpiler({ loader: "ts" });

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { code: string; agent?: any },
): Promise<string> {
    try {
        const r = await ctx.fns.procs.repl.eval({
            code: opts.code,
            bindings: opts.agent ? { agent: opts.agent } : {},
        });
        return r.output ? r.output : "(no output)";
    } catch (e: any) {
        if (e instanceof SyntaxError || /parse error/i.test(String(e?.message ?? ""))) {
            const code = String(opts.code);
            const parses = (head: string) => {
                try { DIAG_TRANSPILER.transformSync(`async function __d() {\n${head}\n}`); return true; }
                catch { return false; }
            };
            const complain = (junk: string): never => {
                throw new SyntaxError(
                    `eval: parse error — the tail of the body is not code: ${JSON.stringify(junk.trim().slice(0, 120))}. ` +
                    `If that is prose you wrote after the code, close the §eval body with a bare § line and put the prose AFTER it.`,
                );
            };
            // Whole trailing lines first…
            const lines = code.split("\n");
            for (let drop = 1; drop <= Math.min(5, lines.length - 1); drop++) {
                if (parses(lines.slice(0, lines.length - drop).join("\n"))) complain(lines.slice(lines.length - drop).join(" "));
            }
            // …then prose glued to the last statement on the same line: cut at
            // each `;` from the right and see if the head becomes valid code.
            for (let i = code.lastIndexOf(";"); i > 0; i = code.lastIndexOf(";", i - 1)) {
                const rest = code.slice(i + 1);
                if (!rest.trim()) continue;
                if (parses(code.slice(0, i + 1))) complain(rest);
            }
        }
        throw e;
    }
}
