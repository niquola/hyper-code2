// Agent-facing eval tool: wraps procs.repl.eval for native JSON tool calls —
//   - `agent` is bound in scope when given (the running agent object)
//   - the result is captured output plus optional structured image content from
//     the last expression (pi-mono style). Plain calls still return a string.
//   - a parse error is DIAGNOSED when non-code text lands in the JSON `code`
//     argument, so the model gets a useful hint instead of a bare parse error.
const DIAG_TRANSPILER = new Bun.Transpiler({ loader: "ts" });

/**
 * Evaluates TypeScript or JavaScript and returns captured output or structured content.
 * @param opts.code Source code to evaluate.
 * @param opts.agent Optional running agent made available to the evaluated code.
 */
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
