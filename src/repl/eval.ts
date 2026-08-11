// Agent-facing eval: wraps procs.repl.eval with the §eval contract —
//   - `agent` is bound in scope when given (the running agent object)
//   - the result is captured output plus optional structured image content from
//     the last expression (pi-mono style). Plain calls still return a string.
//   - a parse error is DIAGNOSED: models glue trailing prose onto the body
//     ("…console.log(x);  ok now check tests" — the cm pattern), and a bare
//     "Parse error" teaches nothing. If the code parses once trailing lines
//     are dropped, the error names the first non-code line and the fix.
const DIAG_TRANSPILER = new Bun.Transpiler({ loader: "ts" });

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { code: string; agent?: any },
): Promise<string | { output: string; content: types.tools.Content[] }> {
    try {
        const r = await ctx.fns.procs.repl.eval({
            code: opts.code,
            bindings: opts.agent ? { agent: opts.agent } : {},
        });
        if (isContent(r.return)) {
            return { output: r.output || contentNote(r.return), content: [r.return] };
        }
        if (Array.isArray(r.return) && r.return.length > 0 && r.return.every(isContent)) {
            return { output: r.output || r.return.map(contentNote).join("\n"), content: r.return };
        }
        return r.output ? r.output : "(no output)";
    } catch (e: any) {
        if (e instanceof SyntaxError || /parse error/i.test(String(e?.message ?? ""))) {
            const d = ctx.fns.repl.diagnoseParse({ code: String(opts.code) });
            if (!d.ok && d.hint) throw new SyntaxError(`eval: parse error — ${d.hint}`);
        }
        throw e;
    }
}


function isContent(value: any): value is types.tools.Content {
    return value?.type === "text" && typeof value.text === "string"
        || value?.type === "image" && typeof value.data === "string" && typeof value.mimeType === "string";
}

function contentNote(value: types.tools.Content): string {
    return value.type === "image" ? `[image: ${value.mimeType}]` : value.text;
}
