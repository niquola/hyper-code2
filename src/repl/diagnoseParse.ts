// Shared parse diagnosis for §eval bodies: models glue trailing prose onto the
// code, and a bare "Parse error" teaches nothing. If the code parses once
// trailing lines are dropped (or after cutting at the last ';'), the hint
// QUOTES the non-code tail and points at the bare-§ close. Used by both the
// eval wrapper (runtime error path) and preflightCall (pre-execution).
const DIAG = new Bun.Transpiler({ loader: "ts" });

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
        `If that is prose you wrote after the code, close the §eval body with a bare § line and put the prose AFTER it.`;
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
