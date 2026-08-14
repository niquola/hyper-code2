// Translate portable `?` placeholders into Postgres `$1..$n`. Skips `?` inside
// single-quoted strings, double-quoted identifiers, and -- / /* */ comments, so
// a literal question mark in SQL text never becomes a parameter. Pure.
/**
 * Perform to pg for the db subsystem.
 * @param opts.sql The SQL statement to execute.
 */
export default function (_ctx: Context, _session: Session | null, opts: { sql: string }): string {
    const s = opts.sql;
    let out = "";
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === "'" || c === '"') {
            const quote = c;
            out += c;
            for (i++; i < s.length; i++) {
                out += s[i];
                if (s[i] === quote) {
                    if (s[i + 1] === quote) { out += s[++i]; continue; } // escaped '' / ""
                    break;
                }
            }
        } else if (c === "-" && s[i + 1] === "-") {
            const end = s.indexOf("\n", i);
            out += s.slice(i, end === -1 ? s.length : end);
            i = end === -1 ? s.length : end - 1;
        } else if (c === "/" && s[i + 1] === "*") {
            const end = s.indexOf("*/", i);
            out += s.slice(i, end === -1 ? s.length : end + 2);
            i = end === -1 ? s.length : end + 1;
        } else if (c === "?") {
            out += "$" + ++n;
        } else {
            out += c;
        }
    }
    return out;
}
