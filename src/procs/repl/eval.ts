// Run TypeScript / JavaScript inside the server process.
// Contract — predictable, Jupyter-style:
//   - Code is the body of `async () => { CODE }`.
//   - In scope: `ctx` (request-scoped, with session), `session`, `console`
//     (captured), `print`. Calls like ctx.fns.x.y({...}) inject ctx/session.
//   - The last expression statement is returned as a JavaScript value.
//   - Errors propagate as exceptions.
const TS_TRANSPILER = new Bun.Transpiler({ loader: 'ts' });

type EvalResult = {
    output: string;
    return: any;
};

function formatArg(a: any): string {
    return typeof a === 'string' ? a : Bun.inspect(a);
}

/**
 * Perform eval for the repl subsystem.
 * @param opts.code The code to process.
 * @param opts.bindings The bindings value used by the operation.
 * @param opts.typecheck The typecheck value used by the operation.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { code: string; bindings?: Record<string, any>; typecheck?: boolean },
): Promise<EvalResult> {
    const code = opts.code;
    const bindings: Record<string, any> = opts.bindings ?? {};
    const configuredTypecheck = opts.typecheck === undefined
        ? await ctx.fns.settings.get({ module: "repl", scopeType: "global", key: "typecheckEval" })
        : undefined;
    const typecheck = opts.typecheck ?? configuredTypecheck;
    if (typecheck !== false) {
        const checked = await ctx.fns.procs.repl.typecheck({ code, bindings });
        if (!checked.ok) throw new TypeError(`eval: typecheck failed:\n${checked.errors.map((e: string) => `  ${e}`).join("\n")}`);
    }
    const buffer: string[] = [];
    const log = (...args: any[]) => {
        buffer.push(args.map(formatArg).join(' '));
    };

    const consoleProxy = {
        log,
        info: log,
        debug: log,
        warn: log,
        error: log,
    };

    // Eval ctx: inherits the caller's ctx; the session flows through.
    const rctx: Context = Object.create(ctx);
    (rctx as any).session = session ?? ctx.session ?? { kind: 'repl' };

    // Bun.Transpiler accepts JS as a subset of TS, so always transpile.
    let js: string;
    try {
        js = TS_TRANSPILER.transformSync(`async function __repl() {
${withLastExpressionReturn(code)}
}`);
    } catch (e: any) {
        throw new SyntaxError('eval: parse error: ' + (e?.message ?? String(e)));
    }

    const names = ['ctx', 'session', 'console', 'print', ...Object.keys(bindings)];
    const values: any[] = [rctx, (rctx as any).session, consoleProxy, log, ...Object.values(bindings)];

    const fn = new Function(...names, `${js}\nreturn __repl()`);
    const result = await fn(...values);

    return { output: buffer.join('\n'), return: result };
}

// Leading keywords that make a statement NOT an expression (so we never wrap it
// in `return (...)`). If the last statement is one of these, the REPL returns
// undefined — same as a script.
const STATEMENT_KEYWORD = /^(async\s+function|const|let|var|if|for|while|do|switch|try|catch|finally|return|throw|break|continue|debugger|function|class|import|export|interface|type|enum|namespace|declare)\b/;

// Wrap the last EXPRESSION statement in `return (...)` so the REPL yields its
// value (Jupyter-style). Rather than hand-tokenize JS (regex literals, template
// strings, comments and multiline expressions all make that fragile), we let the
// transpiler be the oracle: try each statement boundary as the split point,
// closest-to-the-end first, and keep the FIRST where `<prefix> return (<tail>)`
// actually parses. Anything that parses is correct by construction; if nothing
// does (e.g. the last statement is a declaration), run the code unchanged.
function withLastExpressionReturn(code: string): string {
    let end = code.length;                                  // last meaningful char (skip trailing space/`;`)
    while (end > 0 && /[\s;]/.test(code[end - 1]!)) end--;
    if (end === 0) return code;

    // Candidate split points: file start + just after every ';' or newline.
    // Deliberately naive about nesting — a split inside a string/object/comment
    // simply fails to parse and we fall through to an earlier one. Largest first
    // so we wrap the LAST statement, not an earlier prefix of the code.
    const starts = [0];
    for (let i = 0; i < end; i++) if (code[i] === ';' || code[i] === '\n') starts.push(i + 1);
    starts.sort((a, b) => b - a);

    for (const start of starts) {
        let s = start;
        while (s < end && /\s/.test(code[s]!)) s++;
        const tail = code.slice(s, end).trim();
        if (!tail || STATEMENT_KEYWORD.test(tail)) continue; // not an expression → don't wrap
        // `)` on its own line so a trailing line-comment in `tail` can't eat it.
        const candidate = `${code.slice(0, s)}return (\n${tail}\n);`;
        try {
            TS_TRANSPILER.transformSync(`async function __r() {\n${candidate}\n}`);
            return candidate;
        } catch { /* invalid split — try an earlier boundary */ }
    }
    return code; // nothing wrapped cleanly (e.g. last statement is a declaration)
}
