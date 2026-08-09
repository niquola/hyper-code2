// Agent-facing eval: wraps procs.repl.eval with the §eval contract —
//   - `agent` is bound in scope when given (the running agent object)
//   - the result is the captured console/print output as ONE plain string
//     (the body of the §result:eval message), "(no output)" when silent.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { code: string; agent?: any },
): Promise<string> {
    const r = await ctx.fns.procs.repl.eval({
        code: opts.code,
        bindings: opts.agent ? { agent: opts.agent } : {},
    });
    return r.output ? r.output : "(no output)";
}
