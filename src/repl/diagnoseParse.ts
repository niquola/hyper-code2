// Shared parse diagnosis for native eval's JSON `code` argument: a bare
// "Parse error" teaches nothing. If the code parses once trailing lines are
// dropped (or after cutting at the last ';'), the hint quotes the non-code tail.
// Used by both the eval wrapper and pre-execution checks.
const DIAG = new Bun.Transpiler({ loader: "ts" });

/**
 * Diagnoses malformed eval source and identifies likely trailing prose.
 * @param opts.code TypeScript or JavaScript source to inspect.
 */
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { code: string },
): { ok: boolean; hint?: string } {
    const code = String(opts.code ?? "");
    const parses = (head: string) => {
        try { DIAG.transformSync(`async function __d() {\n${head}\n}`); return true; }
        catch { return false; }
    };
    if (parses(code)) return { ok: true };
    const junkHint = (junk: string) =>
        `the tail of the body is not code: ${JSON.stringify(junk.trim().slice(0, 120))}. ` +
        `If that is prose accidentally included in the eval code argument, remove it and keep only TypeScript/JavaScript code.`;
    const lines = code.split("\n");
    for (let drop = 1; drop <= Math.min(5, lines.length - 1); drop++) {
        if (parses(lines.slice(0, lines.length - drop).join("\n"))) {
            return { ok: false, hint: junkHint(lines.slice(lines.length - drop).join(" ")) };
        }
    }
    for (let i = code.lastIndexOf(";"); i > 0; i = code.lastIndexOf(";", i - 1)) {
        const rest = code.slice(i + 1);
        if (!rest.trim()) continue;
        if (parses(code.slice(0, i + 1))) return { ok: false, hint: junkHint(rest) };
    }
    return { ok: false, hint: "eval body does not parse as JS/TS" };
}
