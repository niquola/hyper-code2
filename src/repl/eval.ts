// Run TypeScript / JavaScript inside the agent process.
// Contract — predictable, Jupyter-style:
//   - Code is the body of `async () => { CODE }`.
//   - TypeScript with type annotations is supported (transpiled before exec).
//   - Output is collected from `console.log(...)`, `console.error(...)`, and
//     `print(...)` calls. Each call adds one line to the output buffer.
//     Objects are pretty-printed via `Bun.inspect`; strings stay verbatim.
//   - Multiple `console.log` calls all show up; order preserved.
//   - No `return` keyword needed. The model never has to think about
//     "last expression vs return" — only `console.log`.
//   - If nothing was logged, the result is "(no output)".
//   - Errors propagate as exceptions.
const TS_TRANSPILER = new Bun.Transpiler({ loader: 'ts' });

function formatArg(a: any): string {
    return typeof a === 'string' ? a : Bun.inspect(a);
}

export default async function (
    ctx: Context,
    opts: { code: string; agent?: any },
): Promise<string> {
    const code = opts.code;
    const bindings: Record<string, any> = opts.agent ? { agent: opts.agent } : {};
    const buffer: string[] = [];
    const log = (...args: any[]) => buffer.push(args.map(formatArg).join(' '));
    const errLog = (...args: any[]) => buffer.push(args.map(formatArg).join(' '));

    const consoleProxy = {
        log,
        info: log,
        debug: log,
        warn: errLog,
        error: errLog,
    };

    // Bun.Transpiler accepts JS as a subset of TS, so always transpile.
    let js: string;
    try {
        js = TS_TRANSPILER.transformSync(code);
    } catch (e: any) {
        throw new SyntaxError('eval: parse error: ' + (e?.message ?? String(e)));
    }

    const names = ['ctx', 'console', 'print', ...Object.keys(bindings)];
    const values: any[] = [ctx, consoleProxy, log, ...Object.values(bindings)];

    const fn = new Function(...names, `return (async () => { ${js} })()`);
    await fn(...values);

    return buffer.length === 0 ? '(no output)' : buffer.join('\n');
}
