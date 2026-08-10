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
            const d = ctx.fns.repl.diagnoseParse({ code: String(opts.code) });
            if (!d.ok && d.hint) throw new SyntaxError(`eval: parse error — ${d.hint}`);
        }
        throw e;
    }
}
